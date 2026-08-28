-- ============================================================================
-- Seed: current marketing-site content, so the CMS starts populated and the
-- live site renders identically the moment it points at Supabase.
-- Idempotent — safe to re-run.
-- ============================================================================

-- ── Site settings ──────────────────────────────────────────────────────────
insert into site_settings (id, contact_email, contact_phone, linkedin_url, studio_address, hours,
  footer_tagline, og_image_url, metrics, ticker, socials)
values (
  '00000000-0000-0000-0000-000000000001',
  '4firsttechnologieslimited@gmail.com',
  '+234 906 476 8335',
  'https://www.linkedin.com/company/4firsttechnologieslimited/',
  'Owerri · Imo State · Nigeria',
  'Mon – Fri · 09:00 – 18:00 WAT',
  'Smarter Tech, Safer World.',
  'https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/614fc017-0427-4ad4-8678-d4b1fe56a9f6',
  '[
    {"n":"04","l":"Practice areas"},
    {"n":"100%","l":"In-house engineering"},
    {"n":"NG","l":"Rooted, global-ready"},
    {"n":"2026","l":"Building since"}
  ]'::jsonb,
  '["Signal, not noise.","Certainty at the point of use.","Built in Owerri.","Shipped everywhere."]'::jsonb,
  '[
    {"label":"LinkedIn","href":"https://www.linkedin.com/company/4firsttechnologieslimited/"}
  ]'::jsonb
)
on conflict (id) do nothing;

-- ── Pages (meta + hero) ────────────────────────────────────────────────────
insert into pages (slug, meta_title, meta_description, og_title, og_description, canonical, hero, is_published, published_at)
values
  ('home',
   '4First Technologies — Smarter Tech, Safer World.',
   '4First Technologies is a Nigerian technology company building intelligent systems that eliminate uncertainty in everyday use.',
   '4First Technologies — Smarter Tech, Safer World.',
   '4First Technologies is a Nigerian technology company building intelligent systems that eliminate uncertainty in everyday use.',
   '/',
   '{"eyebrow":"4First Technologies Limited · Owerri, NG","heading":"Intelligent systems that eliminate uncertainty in everyday use.","intro":["We''re a Nigerian technology company building the invisible layer between people and their decisions — software, AI, and secure infrastructure that removes the guesswork from work, mobility, and daily life."]}'::jsonb,
   true, now()),
  ('about',
   'About — 4First Technologies',
   '4First Technologies is a Nigerian engineering company based in Owerri, building software and embedded systems from cloud platforms to the firmware on the device.',
   'About — 4First Technologies',
   'An engineering company that builds across the full stack: software platforms, embedded systems, and the secure infrastructure between them.',
   '/about',
   '{"eyebrow":"§ About — 01","heading":"Software, down to the silicon.","intro":["4First Technologies Limited is a Nigerian engineering company. We build across the full technology stack from firmware running on a sensor board to the cloud platforms and applications that turn its readings into decisions. Most companies pick a layer; we take responsibility for the whole signal path.","That range is deliberate. The products we care about, monitoring systems, connected devices, intelligent tools all fail at the seams between hardware, network, and software. So we removed the seams. One team, one standard, from the first sensor reading to the alert on your phone."]}'::jsonb,
   true, now()),
  ('services',
   'Services — 4First Technologies',
   'Four practices: intelligent systems, product engineering, cybersecurity, and advisory. Built by 4First Technologies.',
   'Services — 4First Technologies',
   'Intelligent systems, product engineering, cybersecurity, advisory.',
   '/services',
   '{"eyebrow":"§ Services","heading":"Four practices, one operating system.","intro":["We''re organised around the disciplines that most often collide in real products. Engineering, AI, and cybersecurity aren''t handed off between vendors — they''re practised on the same team, at the same table."]}'::jsonb,
   true, now()),
  ('work',
   'Work — 4First Technologies',
   'A selection of ongoing and shipped work from 4First Technologies — intelligent systems built in Nigeria.',
   'Work — 4First Technologies',
   'Selected engagements and in-house products.',
   '/work',
   '{"eyebrow":"§ Selected work","heading":"Systems in production.","intro":["A running index of what we''ve built, what we''re building, and where we''ve been useful. Some engagements are under NDA — reach out for a deeper conversation."]}'::jsonb,
   true, now()),
  ('contact',
   'Contact — 4First Technologies',
   'Get in touch with 4First Technologies. Based in Owerri, Nigeria. We reply within two working days.',
   'Contact — 4First Technologies',
   'Start a project or send a note.',
   '/contact',
   '{"eyebrow":"§ Contact","heading":"Say the quiet part loud.","intro":["Tell us the problem in plain language. If it''s the kind of thing we can help with, you''ll hear from a founder within two working days."]}'::jsonb,
   true, now())
on conflict (slug) do nothing;

-- ── Collections ────────────────────────────────────────────────────────────
insert into collections (key, label, heading, subheading, item_shape) values
  ('home.principles',   'Home · Operating principles', 'We build for the moment after the decision.', null, 'numbered'),
  ('home.capabilities', 'Home · Capabilities',         'Four disciplines. One system of thought.',   null, 'capability'),
  ('about.disciplines', 'About · What we build',       'Four disciplines, one signal path.',         null, 'discipline'),
  ('about.convictions', 'About · How we engineer',     'Constraints are the curriculum.',            null, 'numbered'),
  ('about.stack',       'About · The stack',           'What the work is made of.',                  null, 'stack_group'),
  ('about.timeline',    'About · Timeline',            'Short history, long horizon.',               null, 'timeline'),
  ('services.list',     'Services · Practices',        null,                                        null, 'service'),
  ('services.process',  'Services · Process',          'How the work moves.',                        null, 'process'),
  ('work.cases',        'Work · Selected work',        null,                                        null, 'case')
on conflict (key) do nothing;

-- helper to seed items only once per collection
do $$
begin
  if not exists (select 1 from collection_items where collection_key = 'home.principles') then
    insert into collection_items (collection_key, position, data) values
      ('home.principles', 0, '{"n":"01","title":"Certainty over cleverness","body":"Systems that give a straight answer beat systems that impress. We optimise for the moment the user stops guessing."}'),
      ('home.principles', 1, '{"n":"02","title":"Intelligence as infrastructure","body":"AI isn''t a feature — it''s the wiring. We embed it where decisions happen, not where demos look good."}'),
      ('home.principles', 2, '{"n":"03","title":"Built for African context","body":"Bandwidth-aware, resilient, secure. Products that hold up between Owerri and Lagos, not just on staging."}'),
      ('home.principles', 3, '{"n":"04","title":"Cybersecurity as a first move","body":"Every system we ship is threat-modelled before it''s beautified. Trust compounds; regret is expensive."}');
  end if;

  if not exists (select 1 from collection_items where collection_key = 'home.capabilities') then
    insert into collection_items (collection_key, position, data) values
      ('home.capabilities', 0, '{"k":"Intelligent Systems","d":"LLM-backed workflows, decision engines, autonomous processes."}'),
      ('home.capabilities', 1, '{"k":"Product Engineering","d":"Web, mobile, and backend platforms — shipped and maintained."}'),
      ('home.capabilities', 2, '{"k":"Cybersecurity","d":"Threat modelling, hardening, and incident-ready operations."}'),
      ('home.capabilities', 3, '{"k":"Advisory","d":"Technology strategy for founders and mid-market operators."}');
  end if;

  if not exists (select 1 from collection_items where collection_key = 'about.disciplines') then
    insert into collection_items (collection_key, position, data) values
      ('about.disciplines', 0, '{"n":"01","title":"Software Platforms","tag":"Web · Mobile · Cloud","body":"The systems people actually touch, web and mobile applications, APIs, and the backend platforms behind them. We design for the network conditions our users really have: bandwidth-aware frontends, resilient sync, and infrastructure that degrades gracefully instead of failing loudly."}'),
      ('about.disciplines', 1, '{"n":"02","title":"Embedded Systems","tag":"Firmware · Sensors · Edge","body":"Software that lives on hardware. Microcontroller firmware, sensor integration, power-conscious design, and the discipline of shipping code that can''t be hot-fixed from a laptop. When a device is on a wall in Owerri, it has to work — offline, on battery, in heat."}'),
      ('about.disciplines', 2, '{"n":"03","title":"Connected Devices & IoT","tag":"Telemetry · OTA · Fleets","body":"The layer that joins the two: device provisioning, telemetry pipelines, over-the-air updates, and fleet monitoring. We treat every deployed device as a production system, observable, updatable, and accounted for from first boot to end of life."}'),
      ('about.disciplines', 3, '{"n":"04","title":"Intelligent & Secure Systems","tag":"AI · Decision Engines · Security","body":"Intelligence embedded where decisions happen, anomaly detection on sensor streams, LLM-backed workflows, automated alerting. All of it threat-modelled first, because a connected device that isn''t secured is a liability with an antenna."}');
  end if;

  if not exists (select 1 from collection_items where collection_key = 'about.convictions') then
    insert into collection_items (collection_key, position, data) values
      ('about.convictions', 0, '{"n":"01","title":"Hardware honesty","body":"Embedded software doesn''t get the luxury of ''refresh and try again.'' We design for constrained memory, unreliable power, and field conditions. And we let that discipline sharpen our cloud software too."}'),
      ('about.convictions', 1, '{"n":"02","title":"The whole signal path","body":"One team owns the journey from sensor reading to dashboard pixel. No hand-offs between a firmware vendor, a backend shop, and an app agency the seams are where systems fail."}'),
      ('about.convictions', 2, '{"n":"03","title":"Built for African context","body":"Intermittent connectivity, hard power cycles, dust and heat. Our systems are designed to hold state locally, sync when they can, and never leave the user guessing about what''s real."}'),
      ('about.convictions', 3, '{"n":"04","title":"Security before shine","body":"Secure boot, signed updates, least-privilege APIs, threat-modelled architectures. Every layer is hardened before it''s beautified, trust compounds; regret is expensive."}');
  end if;

  if not exists (select 1 from collection_items where collection_key = 'about.stack') then
    insert into collection_items (collection_key, position, data) values
      ('about.stack', 0, '{"k":"Device & Firmware","items":["C / C++ on ARM microcontrollers","ESP32 & STM32 platforms","Sensor buses — I²C, SPI, UART","Low-power & battery-first design"]}'),
      ('about.stack', 1, '{"k":"Connectivity","items":["MQTT & lightweight telemetry","GSM / LTE and Wi-Fi fallback","Over-the-air firmware updates","Offline-first sync strategies"]}'),
      ('about.stack', 2, '{"k":"Platform & Cloud","items":["TypeScript, Node.js & React","Time-series ingestion & alerting","Cloud infrastructure & DevOps","Observability & fleet dashboards"]}'),
      ('about.stack', 3, '{"k":"Intelligence & Security","items":["Anomaly detection on live streams","LLM-backed workflows & agents","Threat modelling & hardening","Incident-ready operations"]}');
  end if;

  if not exists (select 1 from collection_items where collection_key = 'about.timeline') then
    insert into collection_items (collection_key, position, data) values
      ('about.timeline', 0, '{"y":"2026","t":"Founded","d":"Established in Owerri with a mandate to build intelligent, resilient systems — software platforms and the embedded devices they speak to, engineered by one team."}');
  end if;

  if not exists (select 1 from collection_items where collection_key = 'services.list') then
    insert into collection_items (collection_key, position, data) values
      ('services.list', 0, '{"n":"01","title":"Intelligent Systems","tag":"AI · Automation · Decision Engines","body":"We embed intelligence at the point of decision. LLM-backed workflows, retrieval systems, and autonomous processes that turn ambiguous inputs into clear next steps.","deliverables":["Custom AI copilots & agents","Retrieval-augmented knowledge systems","Workflow automation & decision engines","Model evaluation & prompt engineering"]}'),
      ('services.list', 1, '{"n":"02","title":"Product Engineering","tag":"Web · Mobile · Platform","body":"End-to-end product build — from a napkin sketch to a live, monitored, scalable platform. We own the stack: frontend, backend, infra, and the operational cadence that keeps it healthy.","deliverables":["Web & mobile applications","APIs, backend platforms & integrations","Cloud infrastructure & DevOps","Design systems & interaction design"]}'),
      ('services.list', 2, '{"n":"03","title":"Cybersecurity","tag":"Defence · Assurance · Response","body":"Security is our co-founder practice. Threat modelling, hardening, and incident-ready operations for teams that can''t afford to guess whether their systems are safe.","deliverables":["Threat modelling & risk assessment","Application & infrastructure hardening","Security operations & monitoring","Incident response readiness"]}'),
      ('services.list', 3, '{"n":"04","title":"Advisory","tag":"Strategy · Architecture · Diligence","body":"For founders and operators making bet-the-company technology decisions. We help you choose what to build, what to buy, and what to walk away from.","deliverables":["Technology strategy & roadmapping","Architecture review & selection","Technical due diligence","Fractional CTO engagements"]}');
  end if;

  if not exists (select 1 from collection_items where collection_key = 'services.process') then
    insert into collection_items (collection_key, position, data) values
      ('services.process', 0, '{"n":"01","t":"Frame","d":"We define the problem in plain language — the decision, the user, the constraint."}'),
      ('services.process', 1, '{"n":"02","t":"Build","d":"Small, senior team. Working software in weeks, not slides in months."}'),
      ('services.process', 2, '{"n":"03","t":"Harden","d":"Security, observability, and load-tested behaviour baked in — never bolted on."}'),
      ('services.process', 3, '{"n":"04","t":"Operate","d":"We stay after launch. Systems get maintained by the people who built them."}');
  end if;

  if not exists (select 1 from collection_items where collection_key = 'work.cases') then
    insert into collection_items (collection_key, position, data) values
      ('work.cases', 0, '{"year":"2026","title":"In-house intelligent workflow engine","kind":"Internal product","tag":"Intelligent Systems","body":"A decision engine that turns fragmented operational inputs into a single, actionable next step for field teams. Currently in private pilot."}'),
      ('work.cases', 1, '{"year":"2025","title":"Cybersecurity hardening program","kind":"Partner engagement","tag":"Cybersecurity","body":"Threat modelling and infrastructure hardening for a regional mobility platform. Reduced exposed surface area by an order of magnitude within one quarter."}'),
      ('work.cases', 2, '{"year":"2025","title":"Product platform for a media venture","kind":"Partner engagement","tag":"Product Engineering","body":"Full-stack platform build — web, backend, and deployment pipeline — for a sister-brand transtech venture serving urban commuters."}'),
      ('work.cases', 3, '{"year":"2024","title":"Technology advisory · early-stage founder","kind":"Advisory","tag":"Advisory","body":"Architecture selection, vendor triage, and hiring plan for a founder preparing to move from prototype to first paying customers."}');
  end if;
end $$;
