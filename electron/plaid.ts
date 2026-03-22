import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { store } from './store';

function getClient(): PlaidApi {
  const clientId = store.get('plaid.clientId') as string;
  const secret = store.get('plaid.secret') as string;

  if (!clientId || !secret) {
    throw new Error('Plaid credentials not configured');
  }

  const config = new Configuration({
    basePath: PlaidEnvironments.sandbox, // Switch to PlaidEnvironments.production for prod
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  });

  return new PlaidApi(config);
}

export async function createLinkToken(): Promise<string> {
  const client = getClient();
  const response = await client.linkTokenCreate({
    user: { client_user_id: 'inked-user' },
    client_name: 'Inked',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
  });
  return response.data.link_token;
}

export async function exchangePublicToken(publicToken: string): Promise<void> {
  const client = getClient();
  const response = await client.itemPublicTokenExchange({
    public_token: publicToken,
  });
  store.set('plaid.accessToken', response.data.access_token);
  store.set('plaid.itemId', response.data.item_id);
  store.set('finance.configured', true);
}

export async function getBalances() {
  const client = getClient();
  const accessToken = store.get('plaid.accessToken') as string;
  if (!accessToken) throw new Error('No Plaid access token');

  const response = await client.accountsBalanceGet({ access_token: accessToken });
  return response.data.accounts.map(a => ({
    id: a.account_id,
    name: a.name,
    type: a.type,
    currentBalance: a.balances.current ?? 0,
    availableBalance: a.balances.available ?? a.balances.current ?? 0,
    institution: a.official_name ?? a.name,
  }));
}

export async function getRecurring(accountIds: string[]) {
  const client = getClient();
  const accessToken = store.get('plaid.accessToken') as string;
  if (!accessToken) throw new Error('No Plaid access token');

  const response = await client.transactionsRecurringGet({
    access_token: accessToken,
    account_ids: accountIds,
  });
  return {
    inflow: response.data.inflow_streams,
    outflow: response.data.outflow_streams,
  };
}

export async function getCategorySpend(startDate: string, endDate: string) {
  const client = getClient();
  const accessToken = store.get('plaid.accessToken') as string;
  if (!accessToken) throw new Error('No Plaid access token');

  const response = await client.transactionsGet({
    access_token: accessToken,
    start_date: startDate,
    end_date: endDate,
  });

  // Aggregate by category
  const byCategory = new Map<string, number>();
  for (const txn of response.data.transactions) {
    const cat = txn.personal_finance_category?.primary ?? 'UNCATEGORIZED';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + Math.abs(txn.amount));
  }

  return Array.from(byCategory.entries()).map(([category, spent]) => ({
    category,
    spent,
  }));
}
