export const getMarketplaceErrorMessage = (error, t) => {
  const message = typeof error === 'string' ? error : error?.message;
  const code = typeof error === 'object' ? error?.code : null;

  if (
    ['PGRST200', 'PGRST202', 'PGRST205'].includes(code) ||
    /could not find (the table|the function|a relationship).*brick_/i.test(message || '')
  ) {
    return t.marketplaceSetupRequired;
  }

  return message || t.marketplaceRequestFailed;
};
