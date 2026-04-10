import { Command } from 'commander';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export interface ChurchData {
  legal_name: string;
  cnpj: string;
  address: string;
  signer_address: string;
}

export interface DonationRecord {
  tx_hash: string;
  amount: number;
  donor_address: string;
  timestamp: string;
}

export interface GnosisTransaction {
  safe_address: string;
  operation_type: 'CALL' | 'DELEGATECALL' | 'CREATE';
  target: string;
  value: number;
  data: string;
  executed_at: string;
}

/**
 * Save church registration data to Supabase
 */
export async function saveChurch(data: ChurchData): Promise<string> {
  const { data: result, error } = await supabase
    .from('churches')
    .insert([
      {
        legal_name: data.legal_name,
        cnpj: data.cnpj,
        address: data.address,
        signer_address: data.signer_address,
        created_at: new Date().toISOString(),
      },
    ])
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to save church: ${error.message}`);
  }

  return result.id;
}

/**
 * Track donation transaction
 */
export async function trackDonation(
  tx_hash: string,
  amount: number,
  donor_address: string
): Promise<void> {
  const { error } = await supabase.from('donations').insert([
    {
      tx_hash,
      amount,
      donor_address,
      timestamp: new Date().toISOString(),
      status: 'pending',
    },
  ]);

  if (error) {
    throw new Error(`Failed to track donation: ${error.message}`);
  }

  console.log(`Donation tracked: ${tx_hash} (${amount} ETH from ${donor_address})`);
}

/**
 * Record Gnosis Safe transaction
 */
export async function recordGnosisTransaction(
  tx: GnosisTransaction
): Promise<void> {
  const { error } = await supabase.from('gnosis_transactions').insert([
    {
      safe_address: tx.safe_address,
      operation_type: tx.operation_type,
      target: tx.target,
      value: tx.value,
      data: tx.data,
      executed_at: tx.executed_at,
    },
  ]);

  if (error) {
    throw new Error(`Failed to record Gnosis transaction: ${error.message}`);
  }

  console.log(`Gnosis transaction recorded: ${tx.safe_address}`);
}

/**
 * Initialize CLI with admin commands
 */
export function initializeAdminCLI(): Command {
  const program = new Command();

  program
    .command('church-register')
    .description('Register a church in the system')
    .requiredOption('--legal-name <name>', 'Legal name of the church')
    .requiredOption('--cnpj <cnpj>', 'CNPJ (Brazilian tax ID)')
    .requiredOption('--address <address>', 'Physical address')
    .requiredOption('--signer <address>', 'Ethereum signer address')
    .action(async (options) => {
      try {
        const churchId = await saveChurch({
          legal_name: options.legalName,
          cnpj: options.cnpj,
          address: options.address,
          signer_address: options.signer,
        });

        console.log(`✓ Church registered with ID: ${churchId}`);
      } catch (error) {
        console.error(
          `✗ Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    });

  program
    .command('donation-history')
    .description('View donation history for an address')
    .requiredOption('--address <address>', 'Donor address')
    .option(
      '--from <date>',
      'Filter from date (YYYY-MM-DD)',
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
    )
    .option('--to <date>', 'Filter to date (YYYY-MM-DD)', new Date().toISOString().split('T')[0])
    .action(async (options) => {
      try {
        const { data: donations, error } = await supabase
          .from('donations')
          .select('*')
          .eq('donor_address', options.address)
          .gte('timestamp', `${options.from}T00:00:00`)
          .lte('timestamp', `${options.to}T23:59:59`)
          .order('timestamp', { ascending: false });

        if (error) {
          throw error;
        }

        console.log(`Donations from ${options.address}:`);
        console.log('─'.repeat(80));

        if (!donations || donations.length === 0) {
          console.log('No donations found');
          return;
        }

        donations.forEach((donation: any) => {
          console.log(`TX: ${donation.tx_hash}`);
          console.log(`Amount: ${donation.amount} ETH`);
          console.log(`Date: ${new Date(donation.timestamp).toLocaleString()}`);
          console.log(`Status: ${donation.status}`);
          console.log('─'.repeat(80));
        });
      } catch (error) {
        console.error(
          `✗ Failed to fetch donations: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    });

  program
    .command('gnosis-transaction')
    .description('Record a Gnosis Safe transaction')
    .requiredOption('--safe <address>', 'Gnosis Safe address')
    .requiredOption('--operation <type>', 'Operation type: CALL, DELEGATECALL, CREATE')
    .requiredOption('--target <address>', 'Target contract address')
    .option('--value <value>', 'ETH value', '0')
    .option('--data <data>', 'Transaction data (hex)', '0x')
    .action(async (options) => {
      try {
        const validOperations = ['CALL', 'DELEGATECALL', 'CREATE'];

        if (!validOperations.includes(options.operation.toUpperCase())) {
          throw new Error(
            `Invalid operation type. Must be one of: ${validOperations.join(', ')}`
          );
        }

        await recordGnosisTransaction({
          safe_address: options.safe,
          operation_type: options.operation.toUpperCase() as 'CALL' | 'DELEGATECALL' | 'CREATE',
          target: options.target,
          value: parseFloat(options.value),
          data: options.data,
          executed_at: new Date().toISOString(),
        });

        console.log(`✓ Gnosis transaction recorded`);
      } catch (error) {
        console.error(
          `✗ Failed to record transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    });

  return program;
}

export default initializeAdminCLI;
