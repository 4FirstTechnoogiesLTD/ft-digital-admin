-- ============================================================================
-- Seed: current marketing-site content for web-unwrapped-3d, so the CMS starts
-- populated and the live site renders identically the moment it points at
-- Supabase. Keep in sync with web-unwrapped-3d/src/content/defaults.ts.
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
  'Head Office: Imo Digital City Limited, 23 Egbu Road, Owerri, Imo State, Nigeria.',
  'Mon – Fri · 09:00 – 18:00 WAT',
  'Smarter Tech, Safer World.',
  'https://4firsttechnologies.com/main-logo.png',
  $j$[
    {"n":"04","l":"Practice areas"},
    {"n":"100%","l":"In-house engineering"},
    {"n":"NG","l":"Rooted, global-ready"},
    {"n":"2026","l":"Building since"}
  ]$j$::jsonb,
  $j$["Signal, not noise.","Certainty at the point of use.","Built in Owerri.","Shipped everywhere."]$j$::jsonb,
  $j$[{"label":"Linktree","href":"https://linktr.ee/4firsttechnologieslimited"}]$j$::jsonb
)
on conflict (id) do nothing;

-- ── Pages (meta + hero) ────────────────────────────────────────────────────
insert into pages (slug, meta_title, meta_description, og_title, og_description, canonical, hero, is_published, published_at)
values
  ('home',
   $t$4First Technologies — Smarter Tech, Safer World$t$,
   $t$Nigerian technology company building intelligent systems, secure infrastructure and AI-backed products that remove guesswork from everyday decisions.$t$,
   $t$4First Technologies — Smarter Tech, Safer World$t$,
   $t$Intelligent systems, product engineering, cybersecurity and advisory, built in Owerri, shipped everywhere.$t$,
   '/',
   $j${"eyebrow":"4First Technologies Limited · Owerri, NG","heading":"Intelligent systems that eliminate [[uncertainty]] in everyday use.","intro":["We're a Nigerian technology company building the invisible layer between people and their decisions — software, AI and secure infrastructure that removes the guesswork from work, mobility, and daily life."]}$j$::jsonb,
   true, now()),

  ('about',
   $t$About — 4First Technologies$t$,
   $t$4First Technologies is a Nigerian engineering company based in Owerri, building software and embedded systems from cloud platforms to the firmware on the device.$t$,
   $t$About — 4First Technologies$t$,
   $t$An engineering company that builds across the full stack: software platforms, embedded systems, and the secure infrastructure between them.$t$,
   '/about',
   $j${"eyebrow":"§ About — 01","heading":"Software, down to the [[silicon]].","intro":["4First Technologies Limited is a Nigerian technology company developing innovative IoT solutions for the energy and healthcare sectors. Our flagship product, 4FG-Monitor, is a smart cylinder monitoring device that provides real-time visibility into the quantity of LPG or oxygen remaining in a cylinder. It uses weight-based sensing and GSM connectivity to deliver accurate readings and alerts, helping households, businesses, hospitals, and gas retailers improve safety, efficiency, and resource management.","Beyond the device, we are building a digital gas platform that connects consumers, gas retailers, distributors, and service providers. The platform enables smarter refill planning, gas transactions, and data-driven management of the LPG ecosystem.","Our vision is to build intelligent infrastructure that makes critical gas resources more visible, predictable, accessible, and easier to manage across Africa."]}$j$::jsonb,
   true, now()),

  ('services',
   $t$Services — 4First Technologies$t$,
   $t$Four practices: intelligent systems, product engineering, cybersecurity, and advisory. Built by 4First Technologies.$t$,
   $t$Services — 4First Technologies$t$,
   $t$Intelligent systems, product engineering, cybersecurity, advisory.$t$,
   '/services',
   $j${"eyebrow":"§ Services","heading":"Four practices, one [[operating system]].","intro":["We're organised around the disciplines that most often collide in real products. Engineering, AI and cybersecurity aren't handed off between vendors — they're practised on the same team, at the same table."]}$j$::jsonb,
   true, now()),

  ('work',
   $t$Work — 4First Technologies$t$,
   $t$A selection of ongoing and shipped work from 4First Technologies — intelligent systems built in Nigeria.$t$,
   $t$Work — 4First Technologies$t$,
   $t$Selected engagements and in-house products.$t$,
   '/work',
   $j${"eyebrow":"§ Selected work","heading":"Systems in [[production]].","intro":["A running index of what we've built, what we're building and where we've been useful. Some engagements are under NDA — reach out for a deeper conversation."]}$j$::jsonb,
   true, now()),

  ('contact',
   $t$Contact — 4First Technologies$t$,
   $t$Get in touch with 4First Technologies. Based in Owerri, Nigeria. We reply within two working days.$t$,
   $t$Contact — 4First Technologies$t$,
   $t$Start a project or send a note.$t$,
   '/contact',
   $j${"eyebrow":"§ Contact","heading":"Say the [[quiet]] part loud.","intro":["Tell us the problem in plain language. If it's the kind of thing we can help with, you'll hear from a founder within two working days."]}$j$::jsonb,
   true, now()),

  ('mission',
   $t$Our Mission — 4First Technologies$t$,
   $t$Our mission is to engineer innovative, accessible, and scalable technology solutions that solve real-world problems and accelerate Africa's transition into a digitally enabled economy.$t$,
   $t$Our Mission — 4First Technologies$t$,
   $t$Solving real-world problems, connecting people and businesses, and accelerating Africa's digital transformation.$t$,
   '/mission',
   $j${"eyebrow":"§ Our Mission","heading":"Technology that [[creates]] the future.","intro":["At 4First Technologies Limited, our mission is to develop and deploy innovative, accessible and impactful technology solutions that solve real-world problems, improve everyday experiences, strengthen businesses and institutions and contribute meaningfully to the digital transformation of Africa.","We are committed to moving technology beyond ideas and prototypes into practical, scalable products and services that people, businesses, governments and communities can rely on."]}$j$::jsonb,
   true, now()),

  ('vision',
   $t$Our Vision — 4First Technologies$t$,
   $t$To become a leading African technology innovation company, building intelligent, accessible, and scalable solutions that connect people, businesses, devices, and institutions.$t$,
   $t$Our Vision — 4First Technologies$t$,
   $t$A future where innovative technology makes everyday life smarter, industries more efficient, and communities safer.$t$,
   '/vision',
   $j${"eyebrow":"§ Our Vision","heading":"A [[smarter]], safer world, built from Africa.","intro":["At 4First Technologies Limited, our vision is to become a leading African technology company that builds innovative, intelligent and scalable solutions capable of transforming how people, businesses, industries and institutions operate and interact with technology.","We envision a future where technology is not merely a tool used by a few, but an accessible infrastructure for solving everyday problems, creating economic opportunities, improving safety and enabling smarter decision-making across Africa and beyond."]}$j$::jsonb,
   true, now()),

  ('products',
   $t$Products — 4First Technologies$t$,
   $t$4FG-Monitor — a smart, weight-based LPG and oxygen cylinder monitoring device from 4First Technologies. Real-time levels, low-gas alerts, and GSM connectivity for homes, hospitals, and gas retailers.$t$,
   $t$Products — 4First Technologies$t$,
   $t$4FG-Monitor: real-time cylinder monitoring for LPG and oxygen, built for Africa.$t$,
   '/products',
   $j${"eyebrow":"§ Products","heading":"4FG-Monitor: Gas you can [[see]].","intro":["Our flagship IoT device turns a sealed, opaque LPG or oxygen cylinder into something you can actually monitor — real-time levels, low-gas alerts, and usage history, delivered over cellular connectivity to a device that can't be hot-fixed from a laptop once it's on the wall."]}$j$::jsonb,
   true, now())
on conflict (slug) do nothing;

-- ── Collections ────────────────────────────────────────────────────────────
insert into collections (key, label, heading, subheading, item_shape) values
  ('home.principlesIntro',   'Home · Operating principles — section intro', null, null, 'prose'),
  ('home.principles',        'Home · Operating principles',                 null, null, 'step'),
  ('home.capabilitiesIntro', 'Home · Capabilities — section intro',         null, null, 'prose'),
  ('home.capabilities',      'Home · Capabilities',                         null, null, 'step'),
  ('home.engage',            'Home · Engage CTA',                           null, null, 'prose'),
  ('about.buildIntro',       'About · What we build — section intro',       null, null, 'prose'),
  ('about.disciplines',      'About · What we build',                       null, null, 'discipline'),
  ('about.engineering',      'About · How we engineer',                     null, null, 'prose'),
  ('about.convictions',      'About · Convictions',                         null, null, 'point'),
  ('about.timelineIntro',    'About · Timeline — section intro',            null, null, 'prose'),
  ('about.timeline',         'About · Timeline',                            null, null, 'timeline'),
  ('services.list',          'Services · Practices',                        null, null, 'service'),
  ('services.processIntro',  'Services · Process — section intro',          null, null, 'prose'),
  ('services.process',       'Services · Process',                          null, null, 'step'),
  ('work.cases',             'Work · Selected work',                        null, null, 'case'),
  ('work.nda',               'Work · Under NDA',                            null, null, 'prose'),
  ('mission.statement',      'Mission · Core statement',                    null, null, 'prose'),
  ('mission.pointsIntro',    'Mission · Detail — section intro',            null, null, 'prose'),
  ('mission.points',         'Mission · Commitments',                       null, null, 'point'),
  ('vision.statement',       'Vision · Statement',                          null, null, 'prose'),
  ('vision.pointsIntro',     'Vision · Detail — section intro',             null, null, 'prose'),
  ('vision.points',          'Vision · Horizons',                           null, null, 'vision_point'),
  ('vision.longterm',        'Vision · Long-term',                          null, null, 'prose'),
  ('vision.oneline',         'Vision · In one line',                        null, null, 'prose'),
  ('products.problem',       'Products · The problem',                      null, null, 'prose'),
  ('products.howIntro',      'Products · How it works — section intro',     null, null, 'prose'),
  ('products.how',           'Products · How it works',                     null, null, 'step'),
  ('products.audiencesIntro','Products · Who it''s for — section intro',    null, null, 'prose'),
  ('products.audiences',     'Products · Who it''s for',                    null, null, 'point'),
  ('products.beyond',        'Products · Beyond the device',                null, null, 'prose'),
  ('products.platform',      'Products · Platform features',                null, null, 'feature'),
  ('products.cta',           'Products · Get 4FG-Monitor CTA',              null, null, 'prose'),
  ('contact.interests',      'Contact · Interest options',                  null, null, 'feature')
on conflict (key) do nothing;

-- ── Collection items (seed once per collection) ────────────────────────────
do $seed$
begin

  if not exists (select 1 from collection_items where collection_key = 'home.principlesIntro') then
    insert into collection_items (collection_key, position, data) values
      ('home.principlesIntro', 0, $j${"eyebrow":"§ 01 — Operating principles","heading":"We build for the moment after the decision."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'home.principles') then
    insert into collection_items (collection_key, position, data) values
      ('home.principles', 0, $j${"n":"01","t":"Certainty over cleverness","d":"Systems that give a straight answer beat systems that impress. We optimise for the moment the user stops guessing."}$j$),
      ('home.principles', 1, $j${"n":"02","t":"Intelligence as infrastructure","d":"AI isn't a feature, it's the wiring. We embed it where decisions happen, not where demos look good."}$j$),
      ('home.principles', 2, $j${"n":"03","t":"Built for African context","d":"Bandwidth-aware, resilient, secure. Products that hold up between Owerri and Lagos, not just on staging."}$j$),
      ('home.principles', 3, $j${"n":"04","t":"Cybersecurity as a first move","d":"Every system we ship is threat-modelled before it's beautified. Trust compounds; regret is expensive."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'home.capabilitiesIntro') then
    insert into collection_items (collection_key, position, data) values
      ('home.capabilitiesIntro', 0, $j${"eyebrow":"§ 02 — Capabilities","heading":"Four disciplines. One system of thought."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'home.capabilities') then
    insert into collection_items (collection_key, position, data) values
      ('home.capabilities', 0, $j${"n":"01","t":"Intelligent Systems","d":"LLM-backed workflows, decision engines, autonomous processes."}$j$),
      ('home.capabilities', 1, $j${"n":"02","t":"Product Engineering","d":"Web, mobile, and backend platforms — shipped and maintained."}$j$),
      ('home.capabilities', 2, $j${"n":"03","t":"Cybersecurity","d":"Threat modelling, hardening, and incident-ready operations."}$j$),
      ('home.capabilities', 3, $j${"n":"04","t":"Advisory","d":"Technology strategy for founders and mid-market operators."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'home.engage') then
    insert into collection_items (collection_key, position, data) values
      ('home.engage', 0, $j${"eyebrow":"§ 03 — Engage","heading":"Have a system worth removing the doubt from?"}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'about.buildIntro') then
    insert into collection_items (collection_key, position, data) values
      ('about.buildIntro', 0, $j${"eyebrow":"§ 02 — What we build","heading":"Four disciplines, one signal path."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'about.disciplines') then
    insert into collection_items (collection_key, position, data) values
      ('about.disciplines', 0, $j${"n":"01","title":"Software Platforms","tag":"Web · Mobile · Cloud","body":"The systems people actually touch, web and mobile applications, APIs, and the backend platforms behind them. We design for the network conditions our users really have: bandwidth-aware frontends, resilient sync, and infrastructure that degrades gracefully instead of failing loudly."}$j$),
      ('about.disciplines', 1, $j${"n":"02","title":"Embedded Systems","tag":"Firmware · Sensors · Edge","body":"Software that lives on hardware. Microcontroller firmware, sensor integration, power-conscious design, and the discipline of shipping code that can't be hot-fixed from a laptop. When a device is on a wall in Owerri, it has to work — offline, on battery, in heat."}$j$),
      ('about.disciplines', 2, $j${"n":"03","title":"Connected Devices & IoT","tag":"Telemetry · OTA · Fleets","body":"The layer that joins the two: device provisioning, telemetry pipelines, over-the-air updates, and fleet monitoring. We treat every deployed device as a production system, observable, updatable, and accounted for from first boot to end of life."}$j$),
      ('about.disciplines', 3, $j${"n":"04","title":"Intelligent & Secure Systems","tag":"AI · Decision Engines · Security","body":"Intelligence embedded where decisions happen, anomaly detection on sensor streams, LLM-backed workflows, automated alerting. All of it threat-modelled first, because a connected device that isn't secured is a liability with an antenna."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'about.engineering') then
    insert into collection_items (collection_key, position, data) values
      ('about.engineering', 0, $j${"eyebrow":"§ 03 — How we engineer","heading":"Constraints are the curriculum.","body":"Building for devices in the field teaches habits that make every system better — including the ones that only ever live in the cloud."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'about.convictions') then
    insert into collection_items (collection_key, position, data) values
      ('about.convictions', 0, $j${"n":"01","title":"Hardware honesty","body":"Embedded software doesn't get the luxury of 'refresh and try again.' We design for constrained memory, unreliable power, and field conditions. And we let that discipline sharpen our cloud software too."}$j$),
      ('about.convictions', 1, $j${"n":"02","title":"The whole signal path","body":"One team owns the journey from sensor reading to dashboard pixel. No hand-offs between a firmware vendor, a backend shop, and an app agency — the seams are where systems fail."}$j$),
      ('about.convictions', 2, $j${"n":"03","title":"Built for African context","body":"Intermittent connectivity, hard power cycles, dust and heat. Our systems are designed to hold state locally, sync when they can, and never leave the user guessing about what's real."}$j$),
      ('about.convictions', 3, $j${"n":"04","title":"Security before shine","body":"Secure boot, signed updates, least-privilege APIs, threat-modelled architectures. Every layer is hardened before it's beautified — trust compounds; regret is expensive."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'about.timelineIntro') then
    insert into collection_items (collection_key, position, data) values
      ('about.timelineIntro', 0, $j${"eyebrow":"§ 04 — Timeline","heading":"Short history, long horizon."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'about.timeline') then
    insert into collection_items (collection_key, position, data) values
      ('about.timeline', 0, $j${"y":"2026","t":"Founded","d":"Established in Owerri with a mandate to build intelligent, resilient systems — software platforms and the embedded devices they speak to, engineered by one team."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'services.list') then
    insert into collection_items (collection_key, position, data) values
      ('services.list', 0, $j${"n":"01","title":"Intelligent Systems","tag":"AI · Automation · Decision Engines","body":"We embed intelligence at the point of decision. LLM-backed workflows, retrieval systems and autonomous processes that turn ambiguous inputs into clear next steps.","deliverables":["Custom AI copilots & agents","Retrieval-augmented knowledge systems","Workflow automation & decision engines","Model evaluation & prompt engineering"]}$j$),
      ('services.list', 1, $j${"n":"02","title":"Product Engineering","tag":"Web · Mobile · Platform","body":"End-to-end product build from a napkin sketch to a live, monitored, scalable platform. We own the stack: frontend, backend, infra and the operational cadence that keeps it healthy.","deliverables":["Web & mobile applications","APIs, backend platforms & integrations","Cloud infrastructure & DevOps","Design systems & interaction design"]}$j$),
      ('services.list', 2, $j${"n":"03","title":"Cybersecurity","tag":"Defence · Assurance · Response","body":"Security is our co-founder practice. Threat modelling, hardening and incident-ready operations for teams that can't afford to guess whether their systems are safe.","deliverables":["Threat modelling & risk assessment","Application & infrastructure hardening","Security operations & monitoring","Incident response readiness"]}$j$),
      ('services.list', 3, $j${"n":"04","title":"Advisory","tag":"Strategy · Architecture · Diligence","body":"For founders and operators making bet-the-company technology decisions. We help you choose what to build, what to buy and what to walk away from.","deliverables":["Technology strategy & roadmapping","Architecture review & selection","Technical due diligence","Fractional CTO engagements"]}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'services.processIntro') then
    insert into collection_items (collection_key, position, data) values
      ('services.processIntro', 0, $j${"eyebrow":"§ Process","heading":"How the work moves."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'services.process') then
    insert into collection_items (collection_key, position, data) values
      ('services.process', 0, $j${"n":"01","t":"Frame","d":"We define the problem in plain language the decision, the user, the constraint."}$j$),
      ('services.process', 1, $j${"n":"02","t":"Build","d":"Small, senior team. Working software in weeks, not slides in months."}$j$),
      ('services.process', 2, $j${"n":"03","t":"Harden","d":"Security, observability, and load-tested behaviour baked in never bolted on."}$j$),
      ('services.process', 3, $j${"n":"04","t":"Operate","d":"We stay after launch. Systems get maintained by the people who built them."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'work.cases') then
    insert into collection_items (collection_key, position, data) values
      ('work.cases', 0, $j${"year":"2026","kind":"Internal product","tag":"Intelligent Systems","title":"In-house intelligent workflow engine","body":"A decision engine that turns fragmented operational inputs into a single, actionable next step for field teams. Currently in private pilot."}$j$),
      ('work.cases', 1, $j${"year":"2025","kind":"Partner engagement","tag":"Cybersecurity","title":"Cybersecurity hardening program","body":"Threat modelling and infrastructure hardening for a regional mobility platform. Reduced exposed surface area by an order of magnitude within one quarter."}$j$),
      ('work.cases', 2, $j${"year":"2025","kind":"Partner engagement","tag":"Product Engineering","title":"Product platform for a media venture","body":"Full-stack platform build; web, backend and deployment pipeline for a sister-brand transtech venture serving urban commuters."}$j$),
      ('work.cases', 3, $j${"year":"2024","kind":"Advisory","tag":"Advisory","title":"Technology advisory · early-stage founder","body":"Architecture selection, vendor triage and hiring plan for a founder preparing to move from prototype to first paying customers."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'work.nda') then
    insert into collection_items (collection_key, position, data) values
      ('work.nda', 0, $j${"eyebrow":"§ Under NDA","body":"We can talk about most of it in a room. Not all of it on a page."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'mission.statement') then
    insert into collection_items (collection_key, position, data) values
      ('mission.statement', 0, $j${"eyebrow":"§ Core mission statement","quote":"Our mission is to engineer innovative, accessible, and scalable technology solutions that solve real-world problems, connect people and businesses, transform traditional industries, improve safety and efficiency and accelerate Africa's transition into a digitally enabled economy.","footnote":"At 4First Technologies Limited, we are building with the belief that technology should not simply follow the future, it should help create it."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'mission.pointsIntro') then
    insert into collection_items (collection_key, position, data) values
      ('mission.pointsIntro', 0, $j${"eyebrow":"§ Our mission in detail","heading":"Twelve commitments, one direction."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'mission.points') then
    insert into collection_items (collection_key, position, data) values
      ('mission.points', 0, $j${"n":"01","title":"Solve real-world problems through technology","body":"We identify challenges affecting individuals, businesses, industries and communities and transform them into opportunities for technological innovation. Our focus is not technology for its own sake, but technology that delivers measurable value and addresses genuine needs."}$j$),
      ('mission.points', 1, $j${"n":"02","title":"Build innovative products for Africa and emerging markets","body":"We aim to design products that are relevant to our environment, affordable, accessible and capable of solving challenges unique to African markets while maintaining the quality and scalability required for global adoption."}$j$),
      ('mission.points', 2, $j${"n":"03","title":"Connect the physical world with the digital world","body":"Through technologies such as IoT, cloud computing, mobile applications, automation, embedded systems, artificial intelligence and data-driven platforms, we seek to create solutions that allow physical assets, businesses, people and digital systems to communicate and work together seamlessly. Our 4FG Digital Gas Platform and 4FG-Monitor, for example, represent this mission by connecting physical gas cylinders and gas businesses to digital monitoring, ordering, logistics and consumer services."}$j$),
      ('mission.points', 3, $j${"n":"04","title":"Make technology accessible and useful","body":"We believe technological innovation should not be limited to large corporations or highly developed markets. Our mission is to develop solutions that can be understood, accessed and utilized by ordinary individuals, small businesses, institutions and larger organizations."}$j$),
      ('mission.points', 4, $j${"n":"05","title":"Digitize traditional industries and services","body":"We seek to modernize sectors that still depend heavily on manual processes by introducing digital platforms, automation, monitoring, analytics and intelligent systems. We see significant opportunities to transform areas such as energy, logistics, healthcare, education, agriculture, commerce and public services."}$j$),
      ('mission.points', 5, $j${"n":"06","title":"Improve efficiency, transparency, and accountability","body":"Our solutions are designed to reduce unnecessary manual processes, improve access to information, create reliable digital records and enable organizations to make better decisions using accurate and timely data."}$j$),
      ('mission.points', 6, $j${"n":"07","title":"Create connected ecosystems rather than isolated products","body":"We do not simply build standalone applications. Our long-term mission is to develop interconnected ecosystems in which users, businesses, service providers, logistics companies, institutions and technology platforms can interact efficiently."}$j$),
      ('mission.points', 7, $j${"n":"08","title":"Empower businesses through digital transformation","body":"We help businesses adopt technology not merely as an operational tool but as a strategic advantage. Our solutions are intended to help organizations improve customer experience, increase operational efficiency, expand their reach, access better data and create new revenue opportunities."}$j$),
      ('mission.points', 8, $j${"n":"09","title":"Promote safety and reliability through technology","body":"Where technology can prevent accidents, reduce risks, provide early warnings or improve monitoring. We aim to make safety an integral part of our product development philosophy. Our approach to products such as 4FG-Monitor reflects our belief that technology should not only make things easier but also make them safer and more reliable."}$j$),
      ('mission.points', 9, $j${"n":"10","title":"Build for scalability and sustainability","body":"We develop with the future in mind. Our products are designed to evolve as users, markets, technologies and business requirements change. We seek to build sustainable technology businesses rather than short-term solutions."}$j$),
      ('mission.points', 10, $j${"n":"11","title":"Create opportunities through innovation","body":"We believe technology can create jobs, businesses, entrepreneurship opportunities and new economic value. By building digital ecosystems, we aim to create opportunities for developers, engineers, logistics providers, vendors, entrepreneurs and other participants in the technology value chain."}$j$),
      ('mission.points', 11, $j${"n":"12","title":"Collaborate to achieve greater impact","body":"We recognize that meaningful transformation cannot be achieved alone. We seek strategic partnerships with government institutions, private companies, investors, technology organizations, communities, researchers and other stakeholders whose capabilities and resources can help scale our solutions and increase their impact."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'vision.statement') then
    insert into collection_items (collection_key, position, data) values
      ('vision.statement', 0, $j${"eyebrow":"§ Vision statement","quote":"\"To become a leading African technology innovation company, building intelligent, accessible and scalable solutions that connect people, businesses, devices and institutions; transform industries; create economic opportunities; improve safety and efficiency; and shape a smarter, more digitally enabled world.\""}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'vision.pointsIntro') then
    insert into collection_items (collection_key, position, data) values
      ('vision.pointsIntro', 0, $j${"eyebrow":"§ Our vision in detail","heading":"Twelve horizons, one direction."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'vision.points') then
    insert into collection_items (collection_key, position, data) values
      ('vision.points', 0, $j${"n":"01","title":"To become a leading technology innovation company in Africa","body":"We envision 4First Technologies Limited becoming a respected technology company originating from Africa and competing confidently on a global stage. Our ambition is to build products that demonstrate that world-class technology and innovation can be conceived, engineered, tested, deployed and scaled from Africa. We want 4First to be recognized not only as a technology service provider, but as a product-driven technology company that owns, develops and scales its own intellectual property and digital platforms."}$j$),
      ('vision.points', 1, $j${"n":"02","title":"To build technology that solves meaningful problems","body":"Our vision is centered around impact. We want to identify problems that affect individuals, businesses, communities, and industries and build technology capable of solving those problems efficiently. Whether the challenge involves energy, logistics, healthcare, education, commerce, agriculture, security, business operations, or public services, we envision 4First as a company that continuously asks the question below a mindset that will remain at the heart of our innovation.","quote":"What problem exists, and how can technology solve it better?"}$j$),
      ('vision.points', 2, $j${"n":"03","title":"To create intelligent and connected ecosystems","body":"We envision a future where physical infrastructure and digital platforms are deeply connected. Through IoT, artificial intelligence, cloud computing, mobile technologies, embedded systems, automation, data analytics and other emerging technologies, we want to create ecosystems where devices, people, businesses and institutions can communicate seamlessly. Our 4FG Digital Gas Platform is an example of this vision rather than simply creating a device that measures the contents of an LPG cylinder, we envision a full ecosystem, an approach that can be applied to other industries too.","chain":"Gas Cylinder → 4FG-Monitor → Consumer → Mobile App → Gas Supplier → Logistics Provider → Delivery → Digital Records"}$j$),
      ('vision.points', 3, $j${"n":"04","title":"To digitally transform traditional industries","body":"We envision 4First playing a significant role in transforming industries that have historically depended on manual processes and fragmented systems. We believe some of Africa's greatest technological opportunities lie in digitizing existing industries rather than simply creating entirely new ones. Our goal is to introduce technology that makes these industries:","list":["More efficient","More transparent","More accessible","More data-driven","More connected","More customer-focused","More sustainable"]}$j$),
      ('vision.points', 4, $j${"n":"05","title":"To make technology accessible to everyone","body":"Our vision is not to build technology exclusively for large corporations. We want our technology to be practical, affordable, easy to use and adaptable to different environments, serving:","list":["Individuals","Families","Small and medium-sized businesses","Enterprises","Government institutions","Schools","Hospitals","Communities","Service providers","Other organizations"]}$j$),
      ('vision.points', 5, $j${"n":"06","title":"To create a safer and smarter world","body":"Our long-term vision is closely connected to our belief that technology should improve the quality and safety of people's lives. We envision products that can help people monitor, predict, detect, automate and respond to potential problems before they become serious. This is particularly relevant to our IoT products, where real-time monitoring can provide information that would otherwise be unavailable to users. Our philosophy is captured by our brand direction:","quote":"Smarter Tech, Safer World."}$j$),
      ('vision.points', 6, $j${"n":"07","title":"To become a trusted technology partner for government and institutions","body":"We envision 4First becoming a trusted partner for governments, institutions and organizations seeking to modernize their operations and services. Our goal is to participate meaningfully in the development of digitally enabled communities and institutions across Africa, contributing technology and expertise to initiatives involving:","list":["Digital transformation","Smart infrastructure","Public service delivery","Data management","Automation","IoT deployments","Digital platforms","Monitoring systems","Technology-enabled economic development"]}$j$),
      ('vision.points', 7, $j${"n":"08","title":"To build scalable African products for global markets","body":"We do not want our products to be limited by geographical boundaries. Our vision is to identify challenges that exist in Africa and other emerging markets, develop solutions around them and eventually take those solutions to international markets, designing our technology from the beginning with scalability, interoperability, security, reliability and international standards in mind.","chain":"Local Problem → African Solution → Global Product"}$j$),
      ('vision.points', 8, $j${"n":"09","title":"To build a strong culture of research and innovation","body":"We envision 4First as an organization where innovation is continuous. We want our teams to constantly research emerging technologies, experiment with new ideas, test assumptions, develop prototypes, learn from failures and improve existing products. We believe the ability to continuously learn and innovate will determine our long-term competitiveness.","chain":"Research → Ideation → Prototyping → Testing → Validation → Deployment → Improvement → Scale"}$j$),
      ('vision.points', 9, $j${"n":"10","title":"To create economic opportunities","body":"Our vision extends beyond building technology. We envision 4First contributing to economic development by creating opportunities for the people and businesses within our ecosystems. As our platforms grow, we want thousands of people and businesses to be able to participate in the value created by our technology:","list":["Engineers","Developers","Designers","Researchers","Entrepreneurs","Logistics providers","Technology partners","Vendors","Businesses","Other ecosystem participants"]}$j$),
      ('vision.points', 10, $j${"n":"11","title":"To build sustainable technology businesses","body":"We envision 4First becoming a financially sustainable and commercially successful technology company. Innovation must ultimately create sustainable value so our vision is to develop products with viable business models that allow us to continuously build long-term technology businesses, not short-term projects:","list":["Invest in research","Improve our products","Expand our infrastructure","Attract talented people","Enter new markets","Support our customers","Develop new technologies"]}$j$),
      ('vision.points', 11, $j${"n":"12","title":"To establish a portfolio of transformative products","body":"Our vision is for 4First to eventually operate a portfolio of technology products addressing different sectors. Rather than being dependent on one product or one industry, we envision a company with multiple technology platforms and solutions that collectively contribute to our larger mission. The 4FG ecosystem can represent our work in energy and IoT, while future products can address other sectors such as healthcare, logistics, agriculture, education, security, commerce and enterprise technology."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'vision.longterm') then
    insert into collection_items (collection_key, position, data) values
      ('vision.longterm', 0, $j${"eyebrow":"§ Our long-term vision","heading":"More than a technology company, [[an innovation ecosystem]].","body":"Ultimately, we envision 4First Technologies Limited becoming more than a technology company. We envision it becoming an innovation ecosystem — a company that identifies problems, develops technology, creates products, connects stakeholders, creates economic opportunities, and contributes to the digital transformation of Africa.\n\nWe want to build a company whose products are used in people's homes, businesses, hospitals, schools, industries, communities, and institutions. We want to build technology that people can trust, afford, understand, and benefit from."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'vision.oneline') then
    insert into collection_items (collection_key, position, data) values
      ('vision.oneline', 0, $j${"eyebrow":"§ In one line","quote":"\"We envision a future where innovative technology makes everyday life smarter, industries more efficient, businesses more connected, and communities safer.\"","footnote":"Smarter Tech, Safer World."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'products.problem') then
    insert into collection_items (collection_key, position, data) values
      ('products.problem', 0, $j${"eyebrow":"§ The problem","heading":"Cylinders don't tell you when they're about to run out.","body":"LPG and oxygen cylinders are sealed and opaque — the only signal most people get that gas is running low is the flame sputtering out mid-meal, or a ward running short on oxygen with no warning. That's a safety problem for hospitals, a planning problem for retailers, and a daily inconvenience for households. 4FG-Monitor replaces that uncertainty with a live number."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'products.howIntro') then
    insert into collection_items (collection_key, position, data) values
      ('products.howIntro', 0, $j${"eyebrow":"§ How it works","heading":"Sensor to dashboard, one signal path."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'products.how') then
    insert into collection_items (collection_key, position, data) values
      ('products.how', 0, $j${"n":"01","t":"Weigh","d":"The cylinder sits on a load-cell base plate. The device continuously measures total weight and derives net gas or oxygen remaining from the known tare weight."}$j$),
      ('products.how', 1, $j${"n":"02","t":"Transmit","d":"Readings are pushed over GSM to the cloud platform — no home Wi-Fi, router, or app pairing required. It works the same in a rural clinic as it does in a city apartment."}$j$),
      ('products.how', 2, $j${"n":"03","t":"Alert","d":"As levels approach empty, the platform triggers alerts to the user and, where connected, to the retailer or distributor — so a refill can be arranged before the cylinder actually runs dry."}$j$),
      ('products.how', 3, $j${"n":"04","t":"Manage","d":"Usage history, consumption rate, and refill patterns are logged over time, turning a single sensor reading into a picture of how gas is actually being used."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'products.audiencesIntro') then
    insert into collection_items (collection_key, position, data) values
      ('products.audiencesIntro', 0, $j${"eyebrow":"§ Who it's for","heading":"One device, four kinds of urgency."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'products.audiences') then
    insert into collection_items (collection_key, position, data) values
      ('products.audiences', 0, $j${"n":"01","title":"Households","body":"Know exactly how much cooking gas is left without lifting the cylinder or guessing by flame strength. Get a warning before you're mid-meal with an empty tank."}$j$),
      ('products.audiences', 1, $j${"n":"02","title":"Hospitals & clinics","body":"Medical oxygen cannot run out unnoticed. 4FG-Monitor gives facilities staff a live view of oxygen reserves across wards, with alerts that reach the right person before a cylinder is critical."}$j$),
      ('products.audiences', 2, $j${"n":"03","title":"Gas retailers & distributors","body":"See real-time consumption across customer sites instead of waiting for a phone call. Plan delivery routes around actual need, reduce emergency runs, and catch churn before a customer switches supplier."}$j$),
      ('products.audiences', 3, $j${"n":"04","title":"Businesses & institutions","body":"Restaurants, bakeries, and any operation running on bulk LPG get accountable, auditable consumption data instead of relying on staff estimates or manual checks."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'products.beyond') then
    insert into collection_items (collection_key, position, data) values
      ('products.beyond', 0, $j${"eyebrow":"§ Beyond the device","heading":"The digital gas platform.","body":"4FG-Monitor is the sensor layer of a wider platform connecting consumers, retailers, distributors, and service providers — turning individual cylinder readings into smarter refill planning and a more accountable LPG ecosystem across Africa."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'products.platform') then
    insert into collection_items (collection_key, position, data) values
      ('products.platform', 0, $j${"label":"Consumer and retailer web dashboards"}$j$),
      ('products.platform', 1, $j${"label":"Live cylinder-level view per device"}$j$),
      ('products.platform', 2, $j${"label":"Low-level and critical-level alerting"}$j$),
      ('products.platform', 3, $j${"label":"Historical consumption & refill analytics"}$j$),
      ('products.platform', 4, $j${"label":"Multi-site fleet view for distributors"}$j$),
      ('products.platform', 5, $j${"label":"API-ready telemetry for integration"}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'products.cta') then
    insert into collection_items (collection_key, position, data) values
      ('products.cta', 0, $j${"eyebrow":"§ Get 4FG-Monitor","body":"For households, hospitals, retailers, and distributors — talk to us about deployment."}$j$);
  end if;

  if not exists (select 1 from collection_items where collection_key = 'contact.interests') then
    insert into collection_items (collection_key, position, data) values
      ('contact.interests', 0, $j${"label":"Intelligent systems"}$j$),
      ('contact.interests', 1, $j${"label":"Product engineering"}$j$),
      ('contact.interests', 2, $j${"label":"Cybersecurity"}$j$),
      ('contact.interests', 3, $j${"label":"Advisory"}$j$);
  end if;

end $seed$;
