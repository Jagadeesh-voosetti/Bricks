const OWNER_PROFILES = {
  'Usetti Simhachalam / ఉసెట్టి సింహాచలం': 'usetti-simhachalam',
  'Usetti Thrinath / ఉసెట్టి త్రినాథ్': 'usetti-thrinath',
  'Rayala Sambhamurthy / రాయల సాంబమూర్తి': 'rayala-sambhamurthy',
  'Rayala Srinu / రాయల శ్రీను': 'rayala-srinu',
  'Usetti Gangarao / ఉసెట్టి గంగారావు': 'usetti-gangarao',
  'Teppalavalasa Sombhabu / తెప్పలవలస సోంబాబు': 'teppalavalasa-sombhabu',
  'Anakapalli Paradesh / అనకాపల్లి పరదేశు': 'anakapalli-paradesh'
};

const FORM_FIELDS = {
  owner: 'Owner profile / యజమాని ప్రొఫైల్',
  location: 'Kiln or area location / బట్టీ లేదా ప్రాంతం',
  name: 'Brick name / ఇటుక పేరు',
  type: 'Brick type / ఇటుక రకం',
  stock: 'Available stock in bricks / అందుబాటులో ఉన్న నిల్వ (ఇటుకలు)',
  price: 'Price per brick in INR / ఒక్క ఇటుక ధర (రూ.)',
  phone: 'Owner contact phone (private) / యజమాని ఫోన్ (ప్రైవేట్)',
  notes: 'Other details / ఇతర వివరాలు'
};

const REVIEW_STATUS_HEADER = 'Admin review status';
const LISTING_ID_HEADER = 'Published listing ID';
const PENDING_STATUS = 'Pending review';
const APPROVED_STATUS = 'Approved';

function createBrickOwnerIntakeForm() {
  const properties = PropertiesService.getScriptProperties();
  const existingUrl = properties.getProperty('OWNER_FORM_URL');
  if (existingUrl) {
    Logger.log(`Owner form already exists: ${existingUrl}`);
    return existingUrl;
  }

  const form = FormApp.create('Bricks-Land Brick Owner Details / ఇటుకల యజమాని వివరాలు');
  form
    .setDescription(
      'Owners: submit your real brick stock, price, and location. Submissions are private and will appear on your profile only after administrator review. ' +
      'యజమానులారా: మీ నిజమైన ఇటుకల నిల్వ, ధర, ప్రాంత వివరాలు పంపండి. నిర్వాహకుడు పరిశీలించి ఆమోదించిన తర్వాతే మీ ప్రొఫైల్‌లో కనిపిస్తాయి.'
    )
    .setConfirmationMessage(
      'Thank you. Your details are pending administrator review. / ధన్యవాదాలు. మీ వివరాలు నిర్వాహకుని పరిశీలనలో ఉన్నాయి.'
    )
    .setCollectEmail(false)
    .setLimitOneResponsePerUser(false)
    .setShowLinkToRespondAgain(true)
    .setPublishingSummary(false);

  form.addListItem()
    .setTitle(FORM_FIELDS.owner)
    .setChoiceValues(Object.keys(OWNER_PROFILES))
    .setRequired(true);
  form.addTextItem().setTitle(FORM_FIELDS.location).setRequired(true);
  form.addTextItem().setTitle(FORM_FIELDS.name).setRequired(true);
  form.addTextItem().setTitle(FORM_FIELDS.type).setRequired(true);
  form.addTextItem()
    .setTitle(FORM_FIELDS.stock)
    .setHelpText('Use a whole number. / పూర్తిసంఖ్యలో ఇవ్వండి.')
    .setValidation(form.createTextValidation().requireNumberGreaterThanOrEqualTo(0).build())
    .setRequired(true);
  form.addTextItem()
    .setTitle(FORM_FIELDS.price)
    .setHelpText('Amount in rupees for one brick. / ఒక్క ఇటుకకు రూపాయల ధర.')
    .setValidation(form.createTextValidation().requireNumberGreaterThan(0).build())
    .setRequired(true);
  form.addTextItem()
    .setTitle(FORM_FIELDS.phone)
    .setHelpText('Kept private for administrator follow-up; it is not shown publicly. / నిర్వాహకుని సంప్రదింపుల కోసం మాత్రమే.')
    .setRequired(true);
  form.addParagraphTextItem().setTitle(FORM_FIELDS.notes).setRequired(false);

  const spreadsheet = SpreadsheetApp.create('Bricks-Land Owner Details - Admin Review');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());

  ScriptApp.newTrigger('onOwnerFormSubmit').forSpreadsheet(spreadsheet).onFormSubmit().create();
  ScriptApp.newTrigger('onOwnerReviewEdit').forSpreadsheet(spreadsheet).onEdit().create();

  properties.setProperties({
    OWNER_FORM_ID: form.getId(),
    OWNER_FORM_URL: form.getPublishedUrl(),
    OWNER_RESPONSE_SHEET_ID: spreadsheet.getId()
  });

  Logger.log(`Share this form with the owners: ${form.getPublishedUrl()}`);
  Logger.log(`Keep this review spreadsheet private: ${spreadsheet.getUrl()}`);
  return form.getPublishedUrl();
}

function onOwnerFormSubmit(event) {
  const sheet = event.range.getSheet();
  const columns = ensureReviewColumns_(sheet);
  sheet.getRange(event.range.getRow(), columns.status).setValue(PENDING_STATUS);
}

function onOwnerReviewEdit(event) {
  const range = event.range;
  const sheet = range.getSheet();
  if (range.getNumRows() !== 1 || range.getNumColumns() !== 1 || range.getRow() < 2) return;

  const columns = ensureReviewColumns_(sheet);
  if (range.getColumn() !== columns.status || range.getValue() !== APPROVED_STATUS) return;

  const row = sheet.getRange(range.getRow(), 1, 1, sheet.getLastColumn()).getValues()[0];
  try {
    const listingId = publishApprovedSubmission_(sheet, range.getRow(), row);
    sheet.getRange(range.getRow(), columns.listingId).setValue(listingId);
    range.setValue('Published');
  } catch (error) {
    range.setValue(`Error - ${error.message || error}`);
  }
}

function publishApprovedSubmission_(sheet, rowNumber, row) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const response = {};
  headers.forEach((header, index) => {
    response[header] = row[index];
  });

  const ownerId = OWNER_PROFILES[String(response[FORM_FIELDS.owner] || '').trim()];
  if (!ownerId) throw new Error('Choose one of the seven listed owner profiles.');

  const location = String(response[FORM_FIELDS.location] || '').trim();
  const name = String(response[FORM_FIELDS.name] || '').trim();
  const brickType = String(response[FORM_FIELDS.type] || '').trim();
  const stock = Number(response[FORM_FIELDS.stock]);
  const price = Number(response[FORM_FIELDS.price]);
  const phone = String(response[FORM_FIELDS.phone] || '').trim();

  if (location.length < 2 || location.length > 200) throw new Error('Enter a valid kiln or area location.');
  if (name.length < 2 || name.length > 120) throw new Error('Brick name must be between 2 and 120 characters.');
  if (brickType.length > 120) throw new Error('Brick type must be 120 characters or fewer.');
  if (!Number.isSafeInteger(stock) || stock < 0) throw new Error('Stock must be a whole number of zero or more.');
  if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be greater than zero.');
  if (!/^[+\d][\d\s()+-]{6,19}$/.test(phone)) throw new Error('Enter a valid contact phone number.');

  const scriptProperties = PropertiesService.getScriptProperties();
  const supabaseUrl = (scriptProperties.getProperty('SUPABASE_URL') || '').replace(/\/+$/, '');
  const serviceRoleKey = scriptProperties.getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Administrator must configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Script Properties.');
  }

  const headersForApi = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json'
  };
  const ownerResponse = UrlFetchApp.fetch(
    `${supabaseUrl}/rest/v1/brick_owners?id=eq.${encodeURIComponent(ownerId)}`,
    {
      method: 'patch',
      headers: headersForApi,
      payload: JSON.stringify({ location }),
      muteHttpExceptions: true
    }
  );
  assertSuccessfulResponse_(ownerResponse, 'Could not update the owner profile.');

  const submissionKey = `${sheet.getParent().getId()}:${rowNumber}`;
  const listingResponse = UrlFetchApp.fetch(
    `${supabaseUrl}/rest/v1/brick_listings?on_conflict=source_submission_key`,
    {
      method: 'post',
      headers: {
        ...headersForApi,
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      payload: JSON.stringify({
        owner_id: ownerId,
        name,
        brick_type: brickType,
        available_stock: stock,
        price_per_brick: price,
        source_submission_key: submissionKey,
        is_active: true
      }),
      muteHttpExceptions: true
    }
  );
  assertSuccessfulResponse_(listingResponse, 'Could not publish the owner brick listing.');

  const savedListings = JSON.parse(listingResponse.getContentText());
  if (!Array.isArray(savedListings) || !savedListings[0]?.id) {
    throw new Error('Supabase saved the listing but did not return its ID.');
  }
  return savedListings[0].id;
}

function ensureReviewColumns_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  let status = headers.indexOf(REVIEW_STATUS_HEADER) + 1;
  let listingId = headers.indexOf(LISTING_ID_HEADER) + 1;

  if (!status) {
    status = sheet.getLastColumn() + 1;
    sheet.getRange(1, status).setValue(REVIEW_STATUS_HEADER);
  }
  if (!listingId) {
    listingId = sheet.getLastColumn() + 1;
    sheet.getRange(1, listingId).setValue(LISTING_ID_HEADER);
  }
  return { status, listingId };
}

function assertSuccessfulResponse_(response, fallbackMessage) {
  const code = response.getResponseCode();
  if (code >= 200 && code < 300) return;
  const body = response.getContentText();
  throw new Error(`${fallbackMessage} Supabase returned ${code}: ${body.slice(0, 500)}`);
}
