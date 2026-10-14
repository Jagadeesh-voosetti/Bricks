import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

const getRazorpayCredentials = () => {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID');
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!keyId || !keySecret) {
    throw new Error('Razorpay payment has not been configured by the site administrator.');
  }
  return {
    keyId,
    keySecret,
    authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`
  };
};

const makeSignature = async (message: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  );
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const signaturesMatch = (actual: string, expected: string) => {
  if (!/^[a-f\d]{64}$/i.test(actual) || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Only POST requests are supported.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error('Marketplace payment service is missing Supabase configuration.');
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const webhookSignature = request.headers.get('x-razorpay-signature');
    if (webhookSignature) {
      const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
      if (!webhookSecret) {
        return jsonResponse({ error: 'Razorpay webhook verification is not configured.' }, 503);
      }

      const rawBody = await request.text();
      const expected = await makeSignature(rawBody, webhookSecret);
      if (!signaturesMatch(webhookSignature, expected)) {
        return jsonResponse({ error: 'Invalid Razorpay webhook signature.' }, 401);
      }

      const event = JSON.parse(rawBody);
      if (event.event !== 'order.paid') {
        return jsonResponse({ received: true, ignored: true });
      }

      const payment = event.payload?.payment?.entity;
      if (!payment || payment.status !== 'captured' || payment.currency !== 'INR') {
        return jsonResponse({ error: 'The webhook does not contain a captured INR payment.' }, 400);
      }

      const { error: cleanupError } = await adminClient.rpc('release_expired_brick_orders');
      if (cleanupError) return jsonResponse({ error: cleanupError.message }, 500);

      const { data: order, error: orderError } = await adminClient
        .from('brick_orders')
        .select('id, customer_id, advance_amount, payment_method')
        .eq('razorpay_order_id', payment.order_id)
        .maybeSingle();
      if (orderError || !order) {
        return jsonResponse({ error: 'No marketplace order matches this Razorpay order.' }, 404);
      }
      if (
        order.payment_method !== 'online' ||
        payment.amount !== Math.round(Number(order.advance_amount) * 100)
      ) {
        return jsonResponse({ error: 'The captured payment amount does not match the order.' }, 400);
      }

      const { error: confirmError } = await adminClient.rpc('confirm_brick_payment', {
        p_order_id: order.id,
        p_customer_id: order.customer_id,
        p_razorpay_order_id: payment.order_id,
        p_razorpay_payment_id: payment.id
      });
      if (confirmError?.message.includes('Payment window expired')) {
        const { error: cleanupError } = await adminClient.rpc('release_expired_brick_orders');
        if (cleanupError) return jsonResponse({ error: cleanupError.message }, 500);
        const { data: refundClaimed, error: refundClaimError } = await adminClient.rpc(
          'begin_brick_refund',
          { p_order_id: order.id, p_razorpay_payment_id: payment.id }
        );
        if (refundClaimError) return jsonResponse({ error: refundClaimError.message }, 409);
        if (!refundClaimed) return jsonResponse({ received: true, refund_in_progress: true });

        const credentials = getRazorpayCredentials();
        const refundResponse = await fetch(
          `https://api.razorpay.com/v1/payments/${encodeURIComponent(payment.id)}/refund`,
          {
            method: 'POST',
            headers: {
              Authorization: credentials.authorization,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              amount: payment.amount,
              notes: { order_id: order.id, reason: 'Stock reservation expired' }
            })
          }
        );
        if (!refundResponse.ok) {
          const refundError = await refundResponse.json();
          console.error('Automatic refund failed:', refundError.error?.description || 'Unknown error');
          return jsonResponse({
            error: 'Captured payment could not be automatically refunded. Please contact support.'
          }, 502);
        }
        const { error: finishRefundError } = await adminClient.rpc('finish_brick_refund', {
          p_order_id: order.id,
          p_razorpay_payment_id: payment.id
        });
        if (finishRefundError) {
          console.error('Refund was accepted but the order could not be marked refunded:', finishRefundError.message);
          return jsonResponse({ error: 'Refund submitted; order status needs administrator review.' }, 502);
        }
        return jsonResponse({ received: true, refunded: true });
      }
      if (confirmError) return jsonResponse({ error: confirmError.message }, 409);
      return jsonResponse({ received: true, paid: true });
    }

    const authorization = request.headers.get('Authorization') || '';
    const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
      return jsonResponse({ error: 'Please log in before placing an order.' }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return jsonResponse({ error: 'Your login session has expired. Please sign in again.' }, 401);
    }
    const customer = userData.user;
    const body = await request.json();

    if (body.action === 'create') {
      const paymentMethod = body.payment_method === 'offline' ? 'offline' : 'online';
      const deliveryDate = typeof body.delivery_date === 'string'
        ? new Date(`${body.delivery_date}T00:00:00.000Z`)
        : null;
      const customerEmail = typeof body.customer_email === 'string' ? body.customer_email.trim() : '';
      if (
        typeof body.listing_id !== 'string' ||
        !Number.isSafeInteger(body.quantity) ||
        body.quantity < 100 ||
        body.quantity > 1000000 ||
        typeof body.delivery_address !== 'string' ||
        body.delivery_address.trim().length < 8 ||
        body.delivery_address.trim().length > 400 ||
        typeof body.delivery_date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.delivery_date) ||
        !deliveryDate ||
        Number.isNaN(deliveryDate.getTime()) ||
        deliveryDate.toISOString().slice(0, 10) !== body.delivery_date ||
        (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) ||
        !['self_pickup', 'tractor', 'mini_truck', 'lorry'].includes(body.transport_option)
      ) {
        return jsonResponse({ error: 'Enter valid order quantity, delivery address, date, and transport details.' }, 400);
      }

      const credentials = paymentMethod === 'online' ? getRazorpayCredentials() : null;
      const { data: reserved, error: reserveError } = await adminClient.rpc(
        'reserve_brick_order',
        {
          p_customer_id: customer.id,
          p_listing_id: body.listing_id,
          p_quantity: body.quantity,
          p_delivery_note: typeof body.delivery_note === 'string' ? body.delivery_note : '',
          p_delivery_address: body.delivery_address.trim(),
          p_delivery_date: body.delivery_date,
          p_transport_option: body.transport_option,
          p_payment_method: paymentMethod,
          p_customer_name: typeof customer.user_metadata?.full_name === 'string'
            ? customer.user_metadata.full_name
            : '',
          p_customer_phone: customer.phone || '',
          p_customer_email: customerEmail || customer.email || ''
        }
      );
      const reservation = Array.isArray(reserved) ? reserved[0] : null;
      if (reserveError || !reservation) {
        return jsonResponse({ error: reserveError?.message || 'Could not reserve the requested stock.' }, 409);
      }

      if (paymentMethod === 'offline') {
        return jsonResponse({
          order_id: reservation.order_id,
          unit_price: reservation.unit_price,
          total_amount: reservation.total_amount,
          advance_amount: reservation.advance_amount,
          status: 'offline_pending'
        });
      }
      if (!credentials) {
        const { error: releaseError } = await adminClient.rpc('release_brick_order', {
          p_order_id: reservation.order_id,
          p_customer_id: customer.id
        });
        if (releaseError) console.error('Could not release an order without payment credentials:', releaseError.message);
        throw new Error('Online payment is not configured.');
      }

      try {
        const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: credentials.authorization,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: Math.round(Number(reservation.advance_amount) * 100),
            currency: 'INR',
            receipt: reservation.order_id,
            payment_capture: 1,
            notes: {
              marketplace_order_id: reservation.order_id,
              owner_id: reservation.owner_id
            }
          })
        });
        const razorpayOrder = await razorpayResponse.json();
        if (!razorpayResponse.ok) {
          throw new Error(
            typeof razorpayOrder.error?.description === 'string'
              ? razorpayOrder.error.description
              : 'Razorpay could not create the payment order.'
          );
        }

        const { error: saveError } = await adminClient
          .from('brick_orders')
          .update({ razorpay_order_id: razorpayOrder.id })
          .eq('id', reservation.order_id)
          .eq('customer_id', customer.id);
        if (saveError) {
          throw new Error('The payment order could not be linked to the reserved brick order.');
        }

        return jsonResponse({
          key_id: credentials.keyId,
          razorpay_order_id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          order_id: reservation.order_id,
          unit_price: reservation.unit_price,
          total_amount: reservation.total_amount,
          advance_amount: reservation.advance_amount,
          owner_name: reservation.owner_id,
          listing_name: reservation.listing_name
        });
      } catch (error) {
        const { error: releaseError } = await adminClient.rpc('release_brick_order', {
          p_order_id: reservation.order_id,
          p_customer_id: customer.id
        });
        if (releaseError) {
          console.error('Could not release a failed payment reservation:', releaseError.message);
        }
        throw error;
      }
    }

    if (body.action === 'cancel') {
      if (typeof body.order_id !== 'string') {
        return jsonResponse({ error: 'A valid order ID is required.' }, 400);
      }
      const { error: cleanupError } = await adminClient.rpc('release_expired_brick_orders');
      if (cleanupError) return jsonResponse({ error: cleanupError.message }, 500);
      const { data: order, error: orderError } = await adminClient
        .from('brick_orders')
        .select('id, razorpay_order_id, advance_amount, status')
        .eq('id', body.order_id)
        .eq('customer_id', customer.id)
        .maybeSingle();
      if (orderError || !order) {
        return jsonResponse({ error: 'This order could not be found.' }, 404);
      }
      if (order.status !== 'payment_pending') {
        return jsonResponse({
          cancelled: order.status === 'payment_failed',
          paid: order.status === 'paid',
          invoice_number: null
        });
      }

      if (order.razorpay_order_id) {
        const credentials = getRazorpayCredentials();
        const paymentsResponse = await fetch(
          `https://api.razorpay.com/v1/orders/${encodeURIComponent(order.razorpay_order_id)}/payments`,
          { headers: { Authorization: credentials.authorization } }
        );
        const paymentList = await paymentsResponse.json();
        if (!paymentsResponse.ok) {
          return jsonResponse({
            error: paymentList.error?.description || 'Could not confirm payment status before releasing stock.'
          }, 502);
        }
        const capturedPayment = paymentList.items?.find(
          (payment: { status: string; amount: number; currency: string }) =>
            payment.status === 'captured' &&
            payment.amount === Math.round(Number(order.advance_amount) * 100) &&
            payment.currency === 'INR'
        );
        if (capturedPayment) {
          const { error: confirmError } = await adminClient.rpc('confirm_brick_payment', {
            p_order_id: order.id,
            p_customer_id: customer.id,
            p_razorpay_order_id: order.razorpay_order_id,
            p_razorpay_payment_id: capturedPayment.id
          });
          if (!confirmError) {
            return jsonResponse({ cancelled: false, paid: true });
          }
          if (!confirmError.message.includes('Payment window expired')) {
            return jsonResponse({ error: confirmError.message }, 409);
          }

          const { error: cleanupError } = await adminClient.rpc('release_expired_brick_orders');
          if (cleanupError) return jsonResponse({ error: cleanupError.message }, 500);
          const { data: refundClaimed, error: refundClaimError } = await adminClient.rpc(
            'begin_brick_refund',
            { p_order_id: order.id, p_razorpay_payment_id: capturedPayment.id }
          );
          if (refundClaimError) return jsonResponse({ error: refundClaimError.message }, 409);
          if (!refundClaimed) return jsonResponse({ cancelled: true, refund_in_progress: true });

          const refundResponse = await fetch(
            `https://api.razorpay.com/v1/payments/${encodeURIComponent(capturedPayment.id)}/refund`,
            {
              method: 'POST',
              headers: {
                Authorization: credentials.authorization,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                amount: capturedPayment.amount,
                notes: { order_id: order.id, reason: 'Stock reservation expired' }
              })
            }
          );
          if (!refundResponse.ok) {
            const refundError = await refundResponse.json();
            console.error('Automatic refund failed:', refundError.error?.description || 'Unknown error');
            return jsonResponse({
              error: 'Payment was captured after the stock reservation expired. Please contact support for your refund.'
            }, 502);
          }
          const { error: finishRefundError } = await adminClient.rpc('finish_brick_refund', {
            p_order_id: order.id,
            p_razorpay_payment_id: capturedPayment.id
          });
          if (finishRefundError) {
            console.error('Refund was accepted but the order could not be marked refunded:', finishRefundError.message);
            return jsonResponse({ error: 'Refund submitted; order status needs administrator review.' }, 502);
          }
          return jsonResponse({ cancelled: true, refunded: true });
        }
      }

      const { error } = await adminClient.rpc('release_brick_order', {
        p_order_id: body.order_id,
        p_customer_id: customer.id
      });
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ cancelled: true });
    }

    if (body.action === 'verify') {
      const credentials = getRazorpayCredentials();
      if (
        typeof body.order_id !== 'string' ||
        typeof body.razorpay_order_id !== 'string' ||
        typeof body.razorpay_payment_id !== 'string' ||
        typeof body.razorpay_signature !== 'string'
      ) {
        return jsonResponse({ error: 'Razorpay did not return complete payment details.' }, 400);
      }

      const { data: order, error: orderError } = await adminClient
        .from('brick_orders')
        .select('id, customer_id, razorpay_order_id, advance_amount, payment_method, status')
        .eq('id', body.order_id)
        .eq('customer_id', customer.id)
        .maybeSingle();
      if (orderError || !order || order.razorpay_order_id !== body.razorpay_order_id) {
        return jsonResponse({ error: 'This payment does not match your brick order.' }, 400);
      }

      const expectedSignature = await makeSignature(
        `${body.razorpay_order_id}|${body.razorpay_payment_id}`,
        credentials.keySecret
      );
      if (!signaturesMatch(body.razorpay_signature, expectedSignature)) {
        return jsonResponse({ error: 'Payment verification failed. No invoice was issued.' }, 400);
      }

      const paymentResponse = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(body.razorpay_payment_id)}`,
        { headers: { Authorization: credentials.authorization } }
      );
      const payment = await paymentResponse.json();
      const expectedAmount = Math.round(Number(order.advance_amount) * 100);
      if (
        !paymentResponse.ok ||
        order.payment_method !== 'online' ||
        payment.order_id !== body.razorpay_order_id ||
        payment.amount !== expectedAmount ||
        payment.currency !== 'INR' ||
        payment.status !== 'captured'
      ) {
        return jsonResponse({ error: 'Payment is not captured yet. An invoice cannot be issued.' }, 409);
      }

      const { data: confirmed, error: confirmError } = await adminClient.rpc(
        'confirm_brick_payment',
        {
          p_order_id: order.id,
          p_customer_id: customer.id,
          p_razorpay_order_id: body.razorpay_order_id,
          p_razorpay_payment_id: body.razorpay_payment_id
        }
      );
      if (confirmError) {
        if (confirmError.message.includes('Payment window expired')) {
          const { error: cleanupError } = await adminClient.rpc('release_expired_brick_orders');
          if (cleanupError) return jsonResponse({ error: cleanupError.message }, 500);
          const { data: refundClaimed, error: refundClaimError } = await adminClient.rpc(
            'begin_brick_refund',
            { p_order_id: order.id, p_razorpay_payment_id: body.razorpay_payment_id }
          );
          if (refundClaimError) return jsonResponse({ error: refundClaimError.message }, 409);
          if (!refundClaimed) {
            return jsonResponse({
              error: 'The stock reservation expired and the captured payment is being refunded. No invoice was issued.'
            }, 409);
          }

          const refundResponse = await fetch(
            `https://api.razorpay.com/v1/payments/${encodeURIComponent(body.razorpay_payment_id)}/refund`,
            {
              method: 'POST',
              headers: {
                Authorization: credentials.authorization,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ amount: expectedAmount, notes: { order_id: order.id } })
            }
          );
          if (!refundResponse.ok) {
            const refundError = await refundResponse.json();
            console.error('Automatic refund failed:', refundError.error?.description || 'Unknown error');
            return jsonResponse({
              error: 'Payment was captured after the stock reservation expired. Please contact support for your refund.'
            }, 502);
          }
          const { error: finishRefundError } = await adminClient.rpc('finish_brick_refund', {
            p_order_id: order.id,
            p_razorpay_payment_id: body.razorpay_payment_id
          });
          if (finishRefundError) {
            console.error('Refund was accepted but the order could not be marked refunded:', finishRefundError.message);
            return jsonResponse({ error: 'Refund submitted; order status needs administrator review.' }, 502);
          }
          return jsonResponse({
            error: 'The stock reservation expired. Your captured payment has been refunded; no invoice was issued.'
          }, 409);
        }
        return jsonResponse({ error: confirmError.message }, 409);
      }

      const invoice = Array.isArray(confirmed) ? confirmed[0] : confirmed;
      if (!invoice?.invoice_number) {
        throw new Error('Payment was captured, but the invoice record could not be confirmed. Please contact support.');
      }
      return jsonResponse({ paid: true, invoice_number: invoice.invoice_number });
    }

    return jsonResponse({ error: 'Unsupported payment action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment processing failed unexpectedly.';
    console.error('Marketplace payment error:', message);
    return jsonResponse({ error: message }, 500);
  }
});
