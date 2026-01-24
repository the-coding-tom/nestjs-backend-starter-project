import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from '../config/config';

// Create PostgreSQL connection pool
const pool = new Pool({ connectionString: config.databaseUrl });

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Single Prisma instance for the entire application
const prisma = new PrismaClient({
  adapter,
  log: ['warn', 'error'],
});

export default prisma;

