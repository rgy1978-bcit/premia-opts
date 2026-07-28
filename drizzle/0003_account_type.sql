ALTER TABLE "investorGoals" ADD COLUMN IF NOT EXISTS "accountType" varchar(32) DEFAULT 'taxable' NOT NULL;
