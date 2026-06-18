import { useState, useRef } from "react";

// ════════════════════════════════════════════════════════════════
//  CONSTANTS & CONFIG
// ════════════════════════════════════════════════════════════════
const CORS_PROXY = "https://api.allorigins.win/get?url=";
const CORS_PROXY_FALLBACK = "https://corsproxy.io/?url=";

const OSM_CATEGORY_MAP = {
  "restaurants":"restaurant","restaurant":"restaurant","cafe":"cafe","cafes":"cafe",
  "hotels":"hotel","hotel":"hotel","gyms":"gym","gym":"gym","fitness":"gym",
  "hospitals":"hospital","hospital":"hospital","clinics":"clinic","clinic":"clinic",
  "dental":"dentist","dentist":"dentist","pharmacy":"pharmacy","pharmacies":"pharmacy",
  "schools":"school","school":"school","salons":"hairdresser","salon":"hairdresser",
  "beauty parlour":"beauty","beauty":"beauty","shops":"shop","store":"shop",
  "supermarket":"supermarket","bakery":"bakery","bakeries":"bakery",
  "real estate":"real_estate_agent","insurance":"insurance","bank":"bank","banks":"bank",
};

const SERVICE_PRESETS = [
  { label:"Digital Marketing Agency", icon:"📈", serviceName:"Digital Marketing Agency", serviceDesc:"We help businesses grow online through performance marketing, paid ads, content strategy, and brand building across all digital channels.", sellerName:"", brandName:"", portfolioUrl:"", startingPrice:"₹15,000/month", usp:"ROI-focused campaigns, monthly performance reports, dedicated account manager", tone:"professional" },
  { label:"SEO Agency", icon:"🔎", serviceName:"SEO Agency", serviceDesc:"We help businesses rank on the first page of Google and drive consistent organic traffic through technical SEO, content, and link building.", sellerName:"", brandName:"", portfolioUrl:"", startingPrice:"₹8,000/month", usp:"Guaranteed first-page rankings, local SEO, monthly audit reports", tone:"professional" },
  { label:"Social Media Marketing Agency", icon:"💹", serviceName:"Social Media Marketing Agency", serviceDesc:"We manage and grow your brand on Instagram, Facebook, LinkedIn and YouTube with viral content, reels, and targeted paid campaigns.", sellerName:"", brandName:"", portfolioUrl:"", startingPrice:"₹7,000/month", usp:"Daily content creation, real follower growth, weekly analytics", tone:"casual" },
  { label:"AI Automation Agency", icon:"🤖", serviceName:"AI Automation Agency", serviceDesc:"We automate repetitive business tasks using AI — from lead generation and customer support to workflow automation and data processing.", sellerName:"", brandName:"", portfolioUrl:"", startingPrice:"₹20,000", usp:"Save 20+ hours/week, custom AI workflows, no coding needed on your end", tone:"professional" },
  { label:"Software Development Company", icon:"💻", serviceName:"Software Development Company", serviceDesc:"We build custom software solutions — web apps, SaaS platforms, dashboards, CRMs, and internal tools tailored to your business needs.", sellerName:"", brandName:"", portfolioUrl:"", startingPrice:"₹30,000", usp:"Agile development, scalable architecture, post-launch support included", tone:"professional" },
  { label:"Mobile App Development Agency", icon:"📲", serviceName:"Mobile App Development Agency", serviceDesc:"We design and develop high-performance iOS and Android apps for startups and businesses looking to reach customers on mobile.", sellerName:"", brandName:"", portfolioUrl:"", startingPrice:"₹40,000", usp:"Cross-platform apps, App Store submission, 3 months free support", tone:"professional" },
  { label:"Recruitment Agency", icon:"🤝", serviceName:"Recruitment Agency", serviceDesc:"We help businesses hire the right talent fast — from sourcing and screening to final placement across all industries and roles.", sellerName:"", brandName:"", portfolioUrl:"", startingPrice:"₹5,000/hire", usp:"Pre-screened candidates, 30-day replacement guarantee, quick turnaround", tone:"professional" },
  { label:"Loan Consultant", icon:"🏦", serviceName:"Loan Consultant", serviceDesc:"We help individuals and businesses get the best loan deals — home loans, business loans, personal loans with lowest interest rates.", sellerName:"", brandName:"", portfolioUrl:"", startingPrice:"Free Consultation", usp:"Best interest rates, fast approval, all banks covered, zero hidden charges", tone:"friendly" },
  { label:"Real Estate Agency", icon:"🏢", serviceName:"Real Estate Agency", serviceDesc:"We help clients buy, sell, and rent residential and commercial properties with expert market knowledge and end-to-end support.", sellerName:"", brandName:"", portfolioUrl:"", startingPrice:"Free Consultation", usp:"Best property deals, legal assistance, verified listings, zero brokerage options", tone:"professional" },
  { label:"Insurance Agent", icon:"🛡️", serviceName:"Insurance Agent", serviceDesc:"We help individuals and businesses find the best insurance plans — health, life, vehicle, and business insurance at the lowest premiums.", sellerName:"", brandName:"", portfolioUrl:"", startingPrice:"Free Consultation", usp:"Best premium rates, claim support, all top insurers compared, doorstep service", tone:"friendly" },
  { label:"Custom (Define Your Own)", icon:"⚡", serviceName:"", serviceDesc:"", sellerName:"", brandName:"", portfolioUrl:"", startingPrice:"", usp:"", tone:"friendly" },
];

const TONE_OPTIONS = [
  { value:"friendly", label:"Friendly & Warm" },
  { value:"professional", label:"Professional & Formal" },
  { value:"casual", label:"Casual & Conversational" },
  { value:"creative", label:"Creative & Bold" },
  { value:"urgent", label:"Urgent & Direct" },
];

// ════════════════════════════════════════════════════════════════
//  OSM SEARCH
// ════════════════════════════════════════════════════════════════
async function getCityCoords(city) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`, { headers:{"Accept-Language":"en"} });
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function searchBusinessesOSM(city, category) {
  const coords = await getCityCoords(city);
  if (!coords) return [];
  const radius = 10000;
  const cat = category.toLowerCase().trim();
  const osmTag = OSM_CATEGORY_MAP[cat] || cat;
  const query = `[out:json][timeout:30];(node["amenity"="${osmTag}"](around:${radius},${coords.lat},${coords.lon});node["shop"="${osmTag}"](around:${radius},${coords.lat},${coords.lon});node["amenity"="${cat}"](around:${radius},${coords.lat},${coords.lon});node["shop"="${cat}"](around:${radius},${coords.lat},${coords.lon});node["leisure"="${osmTag}"](around:${radius},${coords.lat},${coords.lon}););out body 40;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:"data=" + encodeURIComponent(query),
  });
  const data = await res.json();
  return data.elements || [];
}

// ════════════════════════════════════════════════════════════════
//  WEB CRAWLER — extract emails, phones, social links
// ════════════════════════════════════════════════════════════════
// Spam/theme-developer email domains to skip
const SPAM_EMAIL_DOMAINS = [
  "wixpress.com","squarespace.com","shopify.com","wordpress.com","godaddy.com",
  "sentry.io","example.com","test.com","yourdomain.com","domain.com",
  "micahrich.com","elegantthemes.com","themify.me","themeforest.net",
  "bootstrapious.com","colorlib.com","templatemo.com","themewagon.com",
  "wpbeginner.com","yoast.com","elementor.com","w3schools.com","schema.org",
];

function isSpamEmail(email) {
  const domain = email.split("@")[1]?.toLowerCase() || "";
  return SPAM_EMAIL_DOMAINS.some(d => domain.includes(d));
}

function extractAllContacts(html) {
  if (!html) return { emails:[], whatsapps:[], phones:[], facebooks:[], instagrams:[], linkedins:[], twitters:[] };

  // ── Emails: from mailto: links first (most reliable), then regex
  const mailtoRx = /href=["']mailto:([^"'?>\s]+)/gi;
  const mailtoMatches = [...html.matchAll(mailtoRx)].map(m => m[1].trim().toLowerCase());

  const emailRx = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const banned = [".png",".jpg",".jpeg",".gif",".svg",".webp",".css",".js",".woff","sentry","@2x","@3x"];
  const regexEmails = (html.match(emailRx)||[]).filter(e => {
    const l = e.toLowerCase();
    return !banned.some(b=>l.includes(b))
      && !l.startsWith("noreply") && !l.startsWith("no-reply")
      && !l.startsWith("support@") && !isSpamEmail(l);
  });

  // Prioritize mailto: emails, then regex, dedupe
  const emails = [...new Set([...mailtoMatches, ...regexEmails].map(e=>e.toLowerCase()).filter(e=>e.includes("@") && !isSpamEmail(e)))];

  // ── WhatsApp: wa.me links or whatsapp.com/send
  const waRx = /https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send|web\.whatsapp\.com\/send)[^\s"'<>]*/gi;
  const waMatches = html.match(waRx) || [];
  // Also detect phone numbers in wa.me/XXXXXXX format
  const waPhoneRx = /wa\.me\/(\d{7,15})/gi;
  const waPhoneMatches = [...html.matchAll(waPhoneRx)].map(m=>`https://wa.me/${m[1]}`);
  const whatsapps = [...new Set([...waMatches.map(w=>w.split('"')[0].split("'")[0]), ...waPhoneMatches])];

  // ── Phone numbers: tel: href links + visible phone patterns
  const telRx = /href=["']tel:([+\d\s\-().]{7,20})["']/gi;
  const telMatches = [...html.matchAll(telRx)].map(m=>m[1].trim());
  // Also catch plain Indian mobile patterns: +91-XXXXXXXXXX or 10-digit numbers
  const indiaPhoneRx = /(?:\+91[-\s]?)?[6-9]\d{9}/g;
  const indiaPhones = html.match(indiaPhoneRx) || [];
  const phones = [...new Set([...telMatches, ...indiaPhones])].slice(0,5);

  // ── Facebook: only page-level URLs, skip share/login/policies
  const fbRx = /https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9._\-]+)\/?(?:\?[^"'\s<>]*)?/g;
  const fbSkip = ["sharer","share","dialog","tr","plugins","login","help","legal","privacy","policy","terms","photo","video","watch","marketplace","groups","events","ads","business","pages/create"];
  const fbMatches = [...html.matchAll(fbRx)]
    .map(m=>m[0].split("?")[0].replace(/\/$/, ""))
    .filter(u => !fbSkip.some(s=>u.toLowerCase().includes(s)) && u.split("/").length >= 4 && u.split("/")[3].length > 2);
  const facebooks = [...new Set(fbMatches)].slice(0,3);

  // ── Instagram: profile URLs only
  const igRx = /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)\/?/g;
  const igSkip = ["p","reel","explore","accounts","stories","direct","tv","ar","_u","_n"];
  const igMatches = [...html.matchAll(igRx)]
    .map(m=>`https://instagram.com/${m[1]}`)
    .filter(u => { const seg=u.split("/")[3]; return seg && seg.length>1 && !igSkip.includes(seg); });
  const instagrams = [...new Set(igMatches)].slice(0,3);

  // ── LinkedIn
  const liRx = /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/([a-zA-Z0-9_\-]+)\/?/g;
  const liMatches = [...html.matchAll(liRx)].map(m=>m[0].split("?")[0].replace(/\/$/,""));
  const linkedins = [...new Set(liMatches)].slice(0,2);

  // ── Twitter / X
  const twRx = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?/g;
  const twSkip = ["intent","share","home","search","i","hashtag"];
  const twMatches = [...html.matchAll(twRx)]
    .map(m=>m[0].split("?")[0].replace(/\/$/,""))
    .filter(u => { const seg=u.split("/").pop(); return seg && !twSkip.includes(seg.toLowerCase()); });
  const twitters = [...new Set(twMatches)].slice(0,2);

  return { emails, whatsapps, phones, facebooks, instagrams, linkedins, twitters };
}

async function fetchPage(url) {
  // Try primary proxy first
  try {
    const res = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`);
    if (res.ok) {
      const data = await res.json();
      const html = data.contents || "";
      if (html.length > 300) return html; // got real content
    }
  } catch (_) {}

  // Fallback proxy if primary failed or returned suspiciously thin content
  try {
    const res2 = await fetch(`${CORS_PROXY_FALLBACK}${encodeURIComponent(url)}`);
    if (res2.ok) {
      const html2 = await res2.text();
      if (html2 && html2.length > 300) return html2;
    }
  } catch (_) {}

  return "";
}

async function crawlWebsite(url) {
  const results = { emails:[], whatsapps:[], phones:[], facebooks:[], instagrams:[], linkedins:[], twitters:[], crawlStatus:"" };
  if (!url) { results.crawlStatus = "No website"; return results; }

  let origin;
  try { origin = new URL(url).origin; } catch { results.crawlStatus = "Invalid URL"; return results; }

  // Pages to crawl in priority order
  const pagesToCrawl = [
    url,
    `${origin}/contact`,
    `${origin}/contact-us`,
    `${origin}/contact.html`,
    `${origin}/about`,
    `${origin}/about-us`,
    `${origin}/reach-us`,
    `${origin}/get-in-touch`,
  ];

  let crawledCount = 0;
  const merge = (found) => {
    found.emails.forEach(e => !results.emails.includes(e) && results.emails.push(e));
    found.whatsapps.forEach(w => !results.whatsapps.includes(w) && results.whatsapps.push(w));
    found.phones.forEach(p => !results.phones.includes(p) && results.phones.push(p));
    found.facebooks.forEach(f => !results.facebooks.includes(f) && results.facebooks.push(f));
    found.instagrams.forEach(i => !results.instagrams.includes(i) && results.instagrams.push(i));
    found.linkedins.forEach(l => !results.linkedins.includes(l) && results.linkedins.push(l));
    found.twitters.forEach(t => !results.twitters.includes(t) && results.twitters.push(t));
  };

  for (const page of pagesToCrawl) {
    const html = await fetchPage(page);
    if (!html || html.length < 200) continue;
    crawledCount++;
    merge(extractAllContacts(html));
    // Stop early if we found everything
    if (results.emails.length && results.phones.length && (results.facebooks.length || results.instagrams.length)) break;
  }

  // If homepage had links to other pages, try to follow /contact link found in HTML
  if (crawledCount === 1 && !results.emails.length) {
    const homepageHtml = await fetchPage(url);
    const contactLinkRx = /href=["']([^"']*contact[^"']*|[^"']*reach[^"']*|[^"']*touch[^"']*)["']/gi;
    const contactLinks = [...homepageHtml.matchAll(contactLinkRx)]
      .map(m => { try { return new URL(m[1], origin).href; } catch { return null; } })
      .filter(Boolean).slice(0, 3);
    for (const link of contactLinks) {
      const html = await fetchPage(link);
      if (html) { crawledCount++; merge(extractAllContacts(html)); }
    }
  }

  const totalFound = results.emails.length + results.phones.length + results.facebooks.length + results.instagrams.length + results.whatsapps.length;
  results.crawlStatus = crawledCount > 0
    ? `Crawled ${crawledCount}p · ${totalFound} contacts`
    : "Could not crawl";
  return results;
}

// ════════════════════════════════════════════════════════════════
//  AI VIA GROQ
// ════════════════════════════════════════════════════════════════
function buildServiceContext(svc) {
  return `SELLER INFO:
- Name: ${svc.sellerName||"the sender"}
- Brand: ${svc.brandName||""}
- Service: ${svc.serviceName}
- Description: ${svc.serviceDesc}
- Starting price: ${svc.startingPrice||"not specified"}
- USP: ${svc.usp||""}
- Portfolio: ${svc.portfolioUrl||"not provided"}
- Tone: ${svc.tone}`;
}

async function callGroq(prompt, maxTokens=800) {
  try {
    const res = await fetch("http://localhost:3001/api/chat", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ messages:[{role:"user",content:prompt}], max_tokens:maxTokens }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  } catch { return ""; }
}

async function generateOutreachMessage(business, svc) {
  const contactInfo = [
    business.email && `Email: ${business.email}`,
    business.whatsapp && `WhatsApp available`,
    business.facebook && `Facebook: ${business.facebook}`,
    business.instagram && `Instagram: ${business.instagram}`,
  ].filter(Boolean).join(", ");

  return callGroq(`You are writing a cold outreach message on behalf of a service provider.

${buildServiceContext(svc)}

TARGET BUSINESS:
- Name: ${business.name}
- Type: ${business.category}
- Location: ${business.address}
- Website: ${business.website||"none"}
- Contact info found: ${contactInfo||"none"}

Write a short, personalized outreach message (email format with subject line).
- Mention their specific business type
- Pitch the service clearly with the price
- Reference their online presence if available
- Tone: ${svc.tone}
- Under 150 words
- No fake placeholders`, 600);
}

async function generateWhatsAppMessage(business, svc) {
  return callGroq(`Write a WhatsApp outreach message on behalf of a service provider.

${buildServiceContext(svc)}

Business: ${business.name} (${business.category}), ${business.address}

2-3 sentences max. Mention their business type. Pitch the service + price. End with a question.
Tone: ${svc.tone}. Sound human, not spammy.`, 250);
}

async function generateFollowUp(business, original, svc) {
  return callGroq(`Write a 2-3 sentence follow-up for a business that didn't reply.
${buildServiceContext(svc)}
Business: ${business.name} (${business.category})
Original: ${original.substring(0,200)}
Polite nudge. Tone: ${svc.tone}`, 250);
}

// ════════════════════════════════════════════════════════════════
//  CSV EXPORT
// ════════════════════════════════════════════════════════════════
function exportCSV(leads) {
  const headers = ["Name","Category","Phone","Website","Email","WhatsApp","Facebook","Instagram","LinkedIn","Twitter/X","Address","Crawl Status","Email Status","Outreach Status","Notes"];
  const rows = leads.map(l=>[l.name,l.category,l.phone,l.website,l.email||"",l.whatsapp||"",l.facebook||"",l.instagram||"",l.linkedin||"",l.twitter||"",l.address,l.crawlStatus||"",l.emailStatus,l.outreachStatus||"Not Contacted",l.notes||""]);
  const csv=[headers,...rows].map(r=>r.map(c=>`"${(c||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`leads-${Date.now()}.csv`; a.click();
}

// ════════════════════════════════════════════════════════════════
//  UI HELPERS
// ════════════════════════════════════════════════════════════════
const STATUS_COLORS = {
  "Real Email Found":"#10b981","No Email Found":"#6b7280","Searching...":"#f59e0b","Crawling...":"#f59e0b",
  "Not Contacted":"#6b7280","Emailed":"#3b82f6","Replied":"#10b981",
  "Follow-Up Sent":"#8b5cf6","Not Interested":"#ef4444","WhatsApp Sent":"#25D366","Crawled":"#10b981","Could not crawl":"#ef4444",
};
function Badge({label}) {
  const c=STATUS_COLORS[label]||"#6b7280";
  return <span style={{background:c+"22",color:c,border:`1px solid ${c}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>;
}

function Modal({title,content,onClose}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}} onClick={onClose}>
      <div style={{background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:12,padding:24,maxWidth:660,width:"100%",maxHeight:"82vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{margin:0,color:"#e2e8f0",fontSize:15}}>{title}</h3>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:22}}>×</button>
        </div>
        <pre style={{color:"#cbd5e1",fontSize:13,whiteSpace:"pre-wrap",lineHeight:1.7,margin:0}}>{content}</pre>
      </div>
    </div>
  );
}

function SocialChip({href, label, color}) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:4,background:color+"22",color,border:`1px solid ${color}44`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600,textDecoration:"none",whiteSpace:"nowrap"}}>
      {label}
    </a>
  );
}

// ════════════════════════════════════════════════════════════════
//  LEAD DETAIL PANEL
// ════════════════════════════════════════════════════════════════
function LeadDetail({lead, svc, onClose, onUpdateLead}) {
  const [generatingMsg, setGeneratingMsg] = useState(false);
  const [generatingWA, setGeneratingWA] = useState(false);
  const [generatingFU, setGeneratingFU] = useState(false);
  const [outreachMsg, setOutreachMsg] = useState(lead.outreachMessage||"");
  const [waMsg, setWaMsg] = useState(lead.waMessage||"");
  const [followUp, setFollowUp] = useState(lead.followUp||"");

  const handleGenOutreach = async () => {
    setGeneratingMsg(true);
    const msg = await generateOutreachMessage(lead, svc);
    setOutreachMsg(msg);
    onUpdateLead(lead.id, { outreachMessage: msg });
    setGeneratingMsg(false);
  };

  const handleGenWA = async () => {
    setGeneratingWA(true);
    const msg = await generateWhatsAppMessage(lead, svc);
    setWaMsg(msg);
    onUpdateLead(lead.id, { waMessage: msg });
    setGeneratingWA(false);
  };

  const handleGenFU = async () => {
    setGeneratingFU(true);
    const msg = await generateFollowUp(lead, outreachMsg, svc);
    setFollowUp(msg);
    onUpdateLead(lead.id, { followUp: msg });
    setGeneratingFU(false);
  };

  const openWA = () => {
    const phone = (lead.phone||"").replace(/\D/g,"");
    if (!phone && !lead.whatsapp) { alert("No phone number available for WhatsApp."); return; }
    const waUrl = lead.whatsapp || `https://wa.me/${phone}`;
    window.open(`${waUrl}?text=${encodeURIComponent(waMsg)}`, "_blank");
    onUpdateLead(lead.id, { outreachStatus:"WhatsApp Sent" });
  };

  const S2 = {
    overlay: {position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20},
    panel: {background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:14,padding:24,maxWidth:720,width:"100%",maxHeight:"90vh",overflowY:"auto"},
    section: {marginBottom:20},
    sectionTitle: {fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10},
    row: {display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:8},
    label: {fontSize:12,color:"#64748b",minWidth:90},
    value: {fontSize:13,color:"#e2e8f0"},
    textarea: {width:"100%",background:"#0f1117",border:"1px solid #2d3154",borderRadius:8,padding:"10px 12px",color:"#e2e8f0",fontSize:13,outline:"none",resize:"vertical",lineHeight:1.6,minHeight:100,boxSizing:"border-box"},
    btn: (c="#6366f1")=>({background:c,color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}),
    btnSm: (c="#6366f1")=>({background:c+"22",color:c,border:`1px solid ${c}44`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:600}),
  };

  return (
    <div style={S2.overlay} onClick={onClose}>
      <div style={S2.panel} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div>
            <div style={{fontWeight:700,fontSize:17,color:"#e2e8f0"}}>{lead.name}</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:3}}>{lead.category} · {lead.address}</div>
            <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
              <Badge label={lead.emailStatus}/>
              <Badge label={lead.crawlStatus||"Not crawled"}/>
              <Badge label={lead.outreachStatus}/>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:22}}>×</button>
        </div>

        {/* Contact Info */}
        <div style={S2.section}>
          <div style={S2.sectionTitle}>📋 Contact Information</div>
          <div style={{background:"#0f1117",borderRadius:10,padding:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[
              ["🌐 Website", lead.website, lead.website],
              ["📧 Email", lead.email, lead.email ? `mailto:${lead.email}` : null],
              ["📞 Phone", lead.phone, null],
              ["💬 WhatsApp", lead.whatsapp ? "Available" : "—", lead.whatsapp],
              ["📘 Facebook", lead.facebook ? "View Page" : "—", lead.facebook],
              ["📸 Instagram", lead.instagram ? "View Profile" : "—", lead.instagram],
              ["💼 LinkedIn", lead.linkedin ? "View Profile" : "—", lead.linkedin],
              ["✖️ Twitter/X", lead.twitter ? "View Profile" : "—", lead.twitter],
            ].map(([label, val, href])=>(
              <div key={label} style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:11,color:"#64748b",minWidth:95}}>{label}</span>
                {href
                  ? <a href={href} target="_blank" rel="noreferrer" style={{fontSize:12,color:"#38bdf8",textDecoration:"none"}}>{val || href}</a>
                  : <span style={{fontSize:12,color:val&&val!=="—"?"#e2e8f0":"#374151"}}>{val||"—"}</span>
                }
              </div>
            ))}
          </div>
        </div>

        {/* Social quick links */}
        {(lead.facebook||lead.instagram||lead.linkedin||lead.whatsapp||lead.twitter) && (
          <div style={{...S2.section,display:"flex",gap:8,flexWrap:"wrap"}}>
            <SocialChip href={lead.facebook} label="📘 Facebook" color="#3b82f6"/>
            <SocialChip href={lead.instagram} label="📸 Instagram" color="#e1306c"/>
            <SocialChip href={lead.linkedin} label="💼 LinkedIn" color="#0a66c2"/>
            <SocialChip href={lead.twitter} label="✖️ X / Twitter" color="#1d9bf0"/>
            <SocialChip href={lead.whatsapp} label="💬 WhatsApp" color="#25D366"/>
          </div>
        )}

        {/* Outreach Message */}
        <div style={S2.section}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={S2.sectionTitle}>✉️ Outreach Email</div>
            <div style={{display:"flex",gap:6}}>
              <button style={S2.btnSm("#818cf8")} onClick={handleGenOutreach} disabled={generatingMsg}>{generatingMsg?"Generating...":"✨ Generate"}</button>
              {outreachMsg && <button style={S2.btnSm("#8b5cf6")} onClick={handleGenFU} disabled={generatingFU}>{generatingFU?"...":"↩️ Follow-Up"}</button>}
              {outreachMsg && <button style={S2.btnSm("#10b981")} onClick={()=>{onUpdateLead(lead.id,{outreachStatus:"Emailed"});alert("Marked as emailed!");}}>✓ Mark Emailed</button>}
            </div>
          </div>
          <textarea style={S2.textarea} value={outreachMsg} onChange={e=>{setOutreachMsg(e.target.value);onUpdateLead(lead.id,{outreachMessage:e.target.value});}} placeholder="Click Generate to create an AI outreach email..." />
          {followUp && (
            <>
              <div style={{...S2.sectionTitle,marginTop:12}}>↩️ Follow-Up</div>
              <textarea style={{...S2.textarea,minHeight:70}} value={followUp} onChange={e=>setFollowUp(e.target.value)} />
            </>
          )}
        </div>

        {/* WhatsApp Message */}
        <div style={S2.section}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={S2.sectionTitle}>💬 WhatsApp Message</div>
            <div style={{display:"flex",gap:6}}>
              <button style={S2.btnSm("#25D366")} onClick={handleGenWA} disabled={generatingWA}>{generatingWA?"Generating...":"✨ Generate"}</button>
              {waMsg && <button style={S2.btn("#25D366")} onClick={openWA}>💬 Open WhatsApp</button>}
            </div>
          </div>
          <textarea style={{...S2.textarea,minHeight:80}} value={waMsg} onChange={e=>{setWaMsg(e.target.value);onUpdateLead(lead.id,{waMessage:e.target.value});}} placeholder="Click Generate to create a WhatsApp message..." />
        </div>

        {/* Notes & Status */}
        <div style={S2.section}>
          <div style={S2.sectionTitle}>📝 Notes & Status</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Outreach Status</div>
              <select style={{width:"100%",background:"#0f1117",border:"1px solid #2d3154",borderRadius:8,color:"#e2e8f0",padding:"8px 10px",fontSize:13,cursor:"pointer"}} value={lead.outreachStatus} onChange={e=>onUpdateLead(lead.id,{outreachStatus:e.target.value})}>
                {["Not Contacted","Emailed","Replied","Follow-Up Sent","Not Interested","WhatsApp Sent"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>Notes</div>
              <input style={{width:"100%",background:"#0f1117",border:"1px solid #2d3154",borderRadius:8,color:"#e2e8f0",padding:"8px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}} value={lead.notes||""} onChange={e=>onUpdateLead(lead.id,{notes:e.target.value})} placeholder="Add notes..." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
//  MAIN APP
// ════════════════════════════════════════════════════════════════
export default function LeadGenPro() {
  const [tab, setTab] = useState("service");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [selectedLead, setSelectedLead] = useState(null);
  const abortRef = useRef(false);

  const [selectedPreset, setSelectedPreset] = useState(0);
  const [svc, setSvc] = useState({...SERVICE_PRESETS[0]});
  const svcSaved = useRef({...SERVICE_PRESETS[0]});

  const updateSvc = patch => setSvc(p=>({...p,...patch}));
  const saveService = () => { svcSaved.current={...svc}; alert("Service profile saved! All AI messages will use this."); };
  const applyPreset = idx => { setSelectedPreset(idx); setSvc({...SERVICE_PRESETS[idx],sellerName:svc.sellerName,brandName:svc.brandName,portfolioUrl:svc.portfolioUrl}); };
  const updateLead = (id, patch) => {
    setLeads(prev => prev.map(l => l.id===id ? {...l,...patch} : l));
    setSelectedLead(prev => prev?.id===id ? {...prev,...patch} : prev);
  };

  const runSearch = async () => {
    if (!city.trim()||!category.trim()) { alert("Enter city and category."); return; }
    setLoading(true); abortRef.current=false; setLeads([]);
    setProgress("Finding city coordinates...");

    try {
      const elements = await searchBusinessesOSM(city, category);
      if (!elements.length) {
        setProgress(`No results for "${category}" in ${city}. Try: restaurants, hotels, gyms, clinics, salons, bakeries`);
        setLoading(false); return;
      }

      setProgress(`Found ${elements.length} businesses. Building leads...`);
      const newLeads = elements.map((el,i) => {
        const t = el.tags||{};
        const website = t.website||t["contact:website"]||"";
        const phone = t.phone||t["contact:phone"]||t["contact:mobile"]||"";
        const name = t.name||t["name:en"]||`${category} #${i+1}`;
        const address = [t["addr:housenumber"],t["addr:street"],t["addr:city"]||city].filter(Boolean).join(", ");
        // Pre-fill from OSM tags
        const facebook = t["contact:facebook"]||t["facebook"]||"";
        const instagram = t["contact:instagram"]||t["instagram"]||"";
        return {
          id:`osm_${el.id}`, name, category, phone, website,
          address:address||city, rating:"",
          email:"", whatsapp:"", facebook, instagram, linkedin:"", twitter:"",
          emailStatus: website ? "Pending crawl" : "No website",
          crawlStatus: website ? "Pending" : "No website",
          outreachStatus:"Not Contacted", outreachMessage:"", waMessage:"", followUp:"", notes:"",
        };
      });
      setLeads([...newLeads]);

      // Crawl each website
      for (let i=0; i<newLeads.length; i++) {
        if (abortRef.current) break;
        if (!newLeads[i].website) continue;
        setProgress(`Crawling ${i+1}/${newLeads.length}: ${newLeads[i].name}`);
        updateLead(newLeads[i].id, { crawlStatus:"Crawling...", emailStatus:"Crawling..." });

        const contacts = await crawlWebsite(newLeads[i].website);
        const patch = {
          email: contacts.emails[0]||"",
          whatsapp: contacts.whatsapps[0]||"",
          facebook: newLeads[i].facebook || contacts.facebooks[0]||"",
          instagram: newLeads[i].instagram || contacts.instagrams[0]||"",
          linkedin: contacts.linkedins[0]||"",
          twitter: contacts.twitters[0]||"",
          phone: newLeads[i].phone || contacts.phones[0]||"",
          emailStatus: contacts.emails.length ? "Real Email Found" : "No Email Found",
          crawlStatus: contacts.crawlStatus,
          allEmails: contacts.emails,
          allPhones: contacts.phones,
        };
        newLeads[i] = {...newLeads[i],...patch};
        setLeads([...newLeads]);
      }

      const emailCount = newLeads.filter(l=>l.email).length;
      const fbCount = newLeads.filter(l=>l.facebook).length;
      const igCount = newLeads.filter(l=>l.instagram).length;
      setProgress(`Done! ${newLeads.length} businesses · ${emailCount} emails · ${fbCount} Facebook · ${igCount} Instagram`);
    } catch(err) {
      setProgress("Error: " + err.message);
    }
    setLoading(false);
    setTab("leads");
  };

  const S = {
    app:{fontFamily:"'Inter',system-ui,sans-serif",background:"#0f1117",minHeight:"100vh",color:"#e2e8f0"},
    header:{background:"linear-gradient(135deg,#1a1d2e,#16213e)",borderBottom:"1px solid #2d3154",padding:"18px 28px",display:"flex",alignItems:"center",gap:12},
    logo:{width:36,height:36,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:"#fff",flexShrink:0},
    tabs:{display:"flex",gap:4,padding:"14px 28px 0",borderBottom:"1px solid #1e2340",overflowX:"auto"},
    tab:(a)=>({padding:"8px 14px",borderRadius:"8px 8px 0 0",cursor:"pointer",fontSize:13,fontWeight:500,whiteSpace:"nowrap",background:a?"#1a1d2e":"transparent",color:a?"#818cf8":"#64748b",border:a?"1px solid #2d3154":"1px solid transparent",borderBottom:a?"1px solid #1a1d2e":"1px solid transparent",marginBottom:-1}),
    body:{padding:24},
    card:{background:"#1a1d2e",border:"1px solid #2d3154",borderRadius:12,padding:20,marginBottom:16},
    label:{fontSize:12,color:"#94a3b8",fontWeight:500,marginBottom:5,display:"block"},
    input:{width:"100%",background:"#0f1117",border:"1px solid #2d3154",borderRadius:8,padding:"9px 12px",color:"#e2e8f0",fontSize:14,outline:"none",boxSizing:"border-box"},
    textarea:{width:"100%",background:"#0f1117",border:"1px solid #2d3154",borderRadius:8,padding:"9px 12px",color:"#e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box",resize:"vertical",lineHeight:1.6},
    btn:(c="#6366f1")=>({background:c,color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",cursor:"pointer",fontSize:13,fontWeight:600,display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}),
    btnSm:(c="#6366f1")=>({background:c+"22",color:c,border:`1px solid ${c}44`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:600}),
    table:{width:"100%",borderCollapse:"collapse",fontSize:13},
    th:{textAlign:"left",padding:"10px 12px",color:"#64748b",fontWeight:500,borderBottom:"1px solid #1e2340",whiteSpace:"nowrap"},
    td:{padding:"10px 12px",borderBottom:"1px solid #1a1d2e",verticalAlign:"middle"},
    progress:{background:"#1e2340",border:"1px solid #2d3154",borderRadius:8,padding:"10px 14px",color:"#94a3b8",fontSize:13,marginBottom:14},
    select:{width:"100%",background:"#0f1117",border:"1px solid #2d3154",borderRadius:8,padding:"9px 12px",color:"#e2e8f0",fontSize:14,outline:"none",cursor:"pointer"},
  };

  const stats = {
    total: leads.length,
    emails: leads.filter(l=>l.email).length,
    facebook: leads.filter(l=>l.facebook).length,
    instagram: leads.filter(l=>l.instagram).length,
    linkedin: leads.filter(l=>l.linkedin).length,
    twitter: leads.filter(l=>l.twitter).length,
    whatsapp: leads.filter(l=>l.whatsapp).length,
    emailed: leads.filter(l=>l.outreachStatus==="Emailed").length,
    replied: leads.filter(l=>l.outreachStatus==="Replied").length,
  };

  return (
    <div style={S.app}>
      {selectedLead && <LeadDetail lead={selectedLead} svc={svcSaved.current} onClose={()=>setSelectedLead(null)} onUpdateLead={updateLead} />}

      {/* Header */}
      <div style={S.header}>
        <div style={S.logo}>LP</div>
        <div>
          <div style={{fontWeight:700,fontSize:16,color:"#e2e8f0"}}>LeadGen Pro</div>
          <div style={{fontSize:12,color:"#64748b"}}>{svc.serviceName?`Pitching: ${svc.serviceName}`:"Configure your service first"}</div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:6,flexWrap:"wrap"}}>
          {[["✉️",stats.emails,"#10b981"],["📘",stats.facebook,"#3b82f6"],["📸",stats.instagram,"#e1306c"],["💬",stats.whatsapp,"#25D366"],["💼",stats.linkedin,"#0a66c2"]].map(([icon,val,color])=>(
            <div key={icon} style={{background:color+"22",border:`1px solid ${color}44`,borderRadius:6,padding:"3px 8px",fontSize:12,color}}>{icon} {val}</div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {[["service","⚙️ My Service"],["search","🔍 Search"],["leads",`📋 Leads (${leads.length})`],["tracker","📊 Tracker"]].map(([k,l])=>(
          <button key={k} style={S.tab(tab===k)} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      <div style={S.body}>

        {/* ── MY SERVICE ── */}
        {tab==="service" && (
          <>
            <div style={S.card}>
              <div style={{fontWeight:600,marginBottom:14,color:"#e2e8f0"}}>What service do you offer?</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:4}}>
                {SERVICE_PRESETS.map((p,i)=>(
                  <button key={i} onClick={()=>applyPreset(i)} style={{background:selectedPreset===i?"#6366f122":"#0f1117",border:selectedPreset===i?"2px solid #6366f1":"1px solid #2d3154",borderRadius:10,padding:"12px 10px",cursor:"pointer",textAlign:"left"}}>
                    <div style={{fontSize:20,marginBottom:4}}>{p.icon}</div>
                    <div style={{fontSize:12,fontWeight:600,color:selectedPreset===i?"#818cf8":"#cbd5e1"}}>{p.label}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={S.card}>
              <div style={{fontWeight:600,marginBottom:14,color:"#e2e8f0"}}>Your Profile</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                <div><label style={S.label}>Your Name</label><input style={S.input} placeholder="e.g. Akash Sharma" value={svc.sellerName} onChange={e=>updateSvc({sellerName:e.target.value})} /></div>
                <div><label style={S.label}>Brand / Studio Name</label><input style={S.input} placeholder="e.g. Akash Prism Studio" value={svc.brandName} onChange={e=>updateSvc({brandName:e.target.value})} /></div>
                <div><label style={S.label}>Service Name</label><input style={S.input} value={svc.serviceName} onChange={e=>updateSvc({serviceName:e.target.value})} /></div>
                <div><label style={S.label}>Starting Price</label><input style={S.input} placeholder="e.g. ₹8,000" value={svc.startingPrice} onChange={e=>updateSvc({startingPrice:e.target.value})} /></div>
                <div><label style={S.label}>Portfolio / Website URL</label><input style={S.input} placeholder="https://yourportfolio.com" value={svc.portfolioUrl} onChange={e=>updateSvc({portfolioUrl:e.target.value})} /></div>
                <div><label style={S.label}>Message Tone</label><select style={S.select} value={svc.tone} onChange={e=>updateSvc({tone:e.target.value})}>{TONE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              </div>
              <div style={{marginBottom:14}}><label style={S.label}>Service Description</label><textarea style={{...S.textarea,minHeight:70}} value={svc.serviceDesc} onChange={e=>updateSvc({serviceDesc:e.target.value})} /></div>
              <div style={{marginBottom:18}}><label style={S.label}>Your USP</label><input style={S.input} placeholder="e.g. 7-day delivery, free revisions, ROI guaranteed" value={svc.usp} onChange={e=>updateSvc({usp:e.target.value})} /></div>
              <button style={S.btn()} onClick={saveService}>💾 Save Service Profile</button>
            </div>
          </>
        )}

        {/* ── SEARCH ── */}
        {tab==="search" && (
          <>
            <div style={{background:"#052e16",border:"1px solid #16653444",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#4ade80"}}>
              ✅ <strong>100% Free</strong> — OpenStreetMap + website crawling. No API key needed.
            </div>
            <div style={S.card}>
              <div style={{fontWeight:600,marginBottom:14,color:"#e2e8f0"}}>Search & Crawl Businesses</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                <div><label style={S.label}>City</label><input style={S.input} placeholder="e.g. Jaipur, Mumbai, Delhi" value={city} onChange={e=>setCity(e.target.value)} /></div>
                <div><label style={S.label}>Business Category</label><input style={S.input} placeholder="e.g. restaurants, gyms, clinics" value={category} onChange={e=>setCategory(e.target.value)} /></div>
              </div>
              <div style={{marginBottom:14,background:"#0f1117",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#64748b"}}>
                <strong style={{color:"#94a3b8"}}>After search, for each business with a website the crawler will extract:</strong> Email · WhatsApp · Phone · Facebook · Instagram · LinkedIn
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <button style={S.btn()} onClick={runSearch} disabled={loading}>{loading?"⏳ Crawling...":"🔍 Search & Crawl"}</button>
                {loading && <button style={S.btn("#ef4444")} onClick={()=>{abortRef.current=true;setLoading(false);}}>⛔ Stop</button>}
                {leads.length>0 && <button style={S.btn("#10b981")} onClick={()=>exportCSV(leads)}>⬇️ Export CSV</button>}
              </div>
            </div>
            {progress && <div style={S.progress}>{loading&&"⚙️ "}{progress}</div>}
          </>
        )}

        {/* ── LEADS ── */}
        {tab==="leads" && (
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <div style={{fontWeight:600,color:"#e2e8f0"}}>{leads.length} businesses {loading&&<span style={{color:"#f59e0b",fontSize:12}}>· crawling...</span>}</div>
              {leads.length>0 && <button style={S.btn("#10b981")} onClick={()=>exportCSV(leads)}>⬇️ Export CSV</button>}
            </div>
            {progress && loading && <div style={S.progress}>⚙️ {progress}</div>}
            {leads.length===0 ? (
              <div style={{...S.card,textAlign:"center",color:"#64748b",padding:48}}>Run a search first.</div>
            ) : (
              <div style={{overflowX:"auto"}}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      {["Business","Phone","✉️ Email","💬 WA","📘 FB","📸 IG","💼 LI","✖️ X","Crawl","Outreach",""].map(h=>(
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map(lead=>(
                      <tr key={lead.id} style={{background:lead.email?"#10b98105":"transparent",cursor:"pointer"}} onClick={()=>setSelectedLead(lead)}>
                        <td style={S.td}>
                          <div style={{fontWeight:500,color:"#e2e8f0"}}>{lead.name}</div>
                          <div style={{fontSize:11,color:"#64748b"}}>{lead.address?.split(",").slice(0,2).join(",")}</div>
                          {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:11,color:"#38bdf8",textDecoration:"none"}}>🔗 website</a>}
                        </td>
                        <td style={S.td}><span style={{color:"#818cf8",fontSize:12}}>{lead.phone||"—"}</span></td>
                        <td style={S.td}>{lead.email ? <span style={{color:"#10b981",fontSize:11}}>{lead.email}</span> : <span style={{color:"#374151",fontSize:11}}>—</span>}</td>
                        <td style={S.td}>{lead.whatsapp ? <a href={lead.whatsapp} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{color:"#25D366",fontSize:12,textDecoration:"none"}}>✓</a> : <span style={{color:"#374151"}}>—</span>}</td>
                        <td style={S.td}>{lead.facebook ? <a href={lead.facebook} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{color:"#3b82f6",fontSize:12,textDecoration:"none"}}>✓</a> : <span style={{color:"#374151"}}>—</span>}</td>
                        <td style={S.td}>{lead.instagram ? <a href={lead.instagram} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{color:"#e1306c",fontSize:12,textDecoration:"none"}}>✓</a> : <span style={{color:"#374151"}}>—</span>}</td>
                        <td style={S.td}>{lead.linkedin ? <a href={lead.linkedin} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{color:"#0a66c2",fontSize:12,textDecoration:"none"}}>✓</a> : <span style={{color:"#374151"}}>—</span>}</td>
                        <td style={S.td}>{lead.twitter ? <a href={lead.twitter} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{color:"#1d9bf0",fontSize:12,textDecoration:"none"}}>✓</a> : <span style={{color:"#374151"}}>—</span>}</td>
                        <td style={S.td}><Badge label={lead.crawlStatus||"Pending"}/></td>
                        <td style={S.td}><Badge label={lead.outreachStatus}/></td>
                        <td style={S.td}><button style={{...S.btnSm("#818cf8"),fontSize:11}} onClick={e=>{e.stopPropagation();setSelectedLead(lead);}}>Open →</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── TRACKER ── */}
        {tab==="tracker" && (
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:12,marginBottom:20}}>
              {[
                ["Total Leads",stats.total,"#818cf8"],
                ["Emails Found",stats.emails,"#10b981"],
                ["Facebook",stats.facebook,"#3b82f6"],
                ["Instagram",stats.instagram,"#e1306c"],
                ["WhatsApp",stats.whatsapp,"#25D366"],
                ["LinkedIn",stats.linkedin,"#0a66c2"],
                ["Twitter/X",stats.twitter,"#1d9bf0"],
                ["Emailed",stats.emailed,"#3b82f6"],
                ["Replied",stats.replied,"#10b981"],
              ].map(([label,val,color])=>(
                <div key={label} style={{background:"#1a1d2e",border:`1px solid ${color}33`,borderRadius:10,padding:14}}>
                  <div style={{fontSize:24,fontWeight:700,color}}>{val}</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:3}}>{label}</div>
                </div>
              ))}
            </div>
            {leads.length===0 ? (
              <div style={{...S.card,textAlign:"center",color:"#64748b",padding:48}}>No leads yet.</div>
            ) : (
              <div style={{overflowX:"auto"}}>
                <table style={S.table}>
                  <thead><tr>{["Business","Email","Socials","Crawl Status","Outreach","Notes",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {leads.map(lead=>(
                      <tr key={lead.id}>
                        <td style={S.td}><div style={{fontWeight:500,color:"#e2e8f0",fontSize:13}}>{lead.name}</div><div style={{fontSize:11,color:"#64748b"}}>{lead.phone}</div></td>
                        <td style={S.td}><span style={{color:lead.email?"#10b981":"#374151",fontSize:12}}>{lead.email||"—"}</span></td>
                        <td style={S.td}>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                            {lead.facebook && <SocialChip href={lead.facebook} label="FB" color="#3b82f6"/>}
                            {lead.instagram && <SocialChip href={lead.instagram} label="IG" color="#e1306c"/>}
                            {lead.linkedin && <SocialChip href={lead.linkedin} label="LI" color="#0a66c2"/>}
                            {lead.twitter && <SocialChip href={lead.twitter} label="X" color="#1d9bf0"/>}
                            {lead.whatsapp && <SocialChip href={lead.whatsapp} label="WA" color="#25D366"/>}
                            {!lead.facebook&&!lead.instagram&&!lead.linkedin&&!lead.whatsapp&&!lead.twitter && <span style={{color:"#374151",fontSize:12}}>—</span>}
                          </div>
                        </td>
                        <td style={S.td}><Badge label={lead.crawlStatus||"Pending"}/></td>
                        <td style={S.td}>
                          <select style={{background:"#0f1117",border:"1px solid #2d3154",borderRadius:6,color:"#e2e8f0",padding:"4px 8px",fontSize:12,cursor:"pointer"}} value={lead.outreachStatus} onChange={e=>updateLead(lead.id,{outreachStatus:e.target.value})}>
                            {["Not Contacted","Emailed","Replied","Follow-Up Sent","Not Interested","WhatsApp Sent"].map(s=><option key={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={S.td}><input style={{background:"transparent",border:"1px solid #1e2340",borderRadius:6,color:"#94a3b8",padding:"4px 8px",fontSize:12,width:140,outline:"none"}} value={lead.notes||""} onChange={e=>updateLead(lead.id,{notes:e.target.value})} placeholder="Add note..." /></td>
                        <td style={S.td}><button style={S.btnSm("#818cf8")} onClick={()=>setSelectedLead(lead)}>Open →</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
