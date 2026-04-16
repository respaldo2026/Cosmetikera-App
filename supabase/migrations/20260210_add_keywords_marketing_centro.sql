-- Adds keywords array to marketing_centro for better matching in the bot/marketing center UI
ALTER TABLE marketing_centro
ADD COLUMN IF NOT EXISTS keywords text[];
