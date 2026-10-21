-- Route all job-application alerts to the careers mailbox.
-- The recipient is snapshotted per notification at submit time, so also repoint
-- anything not yet delivered.
update recruitment_settings
   set notification_email = 'careers@4firsttechnologies.com'
 where id;

update application_notifications
   set recipient = 'careers@4firsttechnologies.com'
 where delivery_status <> 'sent';
