-- Fix typo in mailbox domain: technolgies → technologies
UPDATE public.mailboxes
SET address = REPLACE(address, '@4firsttechnolgies.com', '@4firsttechnologies.com')
WHERE address LIKE '%@4firsttechnolgies.com%';
