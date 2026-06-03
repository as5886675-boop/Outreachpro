import { useState, useEffect } from "react";

// ── CONFIG — update BACKEND_URL after deploying backend to Vercel ─────────────
const BACKEND_URL = ""; // e.g. "https://outreachpro-backend.vercel.app"
const CLAUDE_URL  = BACKEND_URL ? `${BACKEND_URL}/api/claude`     : "";
const SEND_URL    = BACKEND_URL ? `${BACKEND_URL}/api/send-email` : "";
const VALIDATE_URL= BACKEND_URL ? `${BACKEND_URL}/api/validate`   : "";
const APP_VERSION = "5.0.0";
const TABS = ["Send","Compose","Tracker","Follow-ups","Settings"];
const MAX_LEADS_PER_BATCH = 20; // Maximum per AI call

const TEMPLATES = {
  clinic: {
    subject: n => `Website for ${n} — Patients Can't Find You Online`,
    body: (n,c,sender,senderCity,demo) =>
`Hi,

I was searching for clinics in ${c||"your area"} and noticed ${n} doesn't have a website yet.

Most patients today search Google before visiting a clinic. Without a website, you may be losing patients to competitors who are easier to find.

I built a demo clinic website — see exactly what yours could look like:
👉 ${demo||"https://yourdemo.netlify.app"}

Includes mobile-friendly design, WhatsApp booking, Google Maps, doctor info, and appointment section.

You pay ONLY after the website is delivered. Zero advance payment.

Would you be open to a quick chat?

Best regards,
${sender}
Web Designer | ${senderCity}`,
  },
  restaurant: {
    subject: n => `More Customers for ${n} — Get Found on Google`,
    body: (n,c,sender,senderCity,demo) =>
`Hi,

I came across ${n} and noticed you don't have a website yet.

Most people search Google before deciding where to eat. A website with your menu and location can bring significantly more customers.

Demo website I built for restaurants:
👉 ${demo||"https://yourdemo.netlify.app"}

Includes menu, location, WhatsApp orders, and mobile-friendly design.

Zero advance payment — you only pay after you're happy with it.

Interested?

Best regards,
${sender}
Web Designer | ${senderCity}`,
  },
};

// ── STORAGE ───────────────────────────────────────────────────────────────────
const store = {
  auth:  { get:()=>{try{const d=localStorage.getItem("op_auth");return d?JSON.parse(d):null}catch{return null}}, set:v=>{try{localStorage.setItem("op_auth",JSON.stringify(v))}catch{}} },
  leads: { get:()=>{try{const d=localStorage.getItem("op_leads");return d?JSON.parse(d):[]}catch{return[]}}, set:v=>{try{localStorage.setItem("op_leads",JSON.stringify(v))}catch{}} },
  daily: {
    get:()=>{try{return parseInt(localStorage.getItem("op_d_"+new Date().toDateString())||"0")}catch{return 0}},
    inc:n=>{try{const k="op_d_"+new Date().toDateString();localStorage.setItem(k,(parseInt(localStorage.getItem(k)||"0")+n))}catch{}},
  },
};

// ── API HELPERS ───────────────────────────────────────────────────────────────
async function callClaude(messages, auth) {
  // Use backend proxy if available, otherwise call directly
  const url = CLAUDE_URL || "https://api.anthropic.com/v1/messages";
  const body = CLAUDE_URL
    ? { messages, license_key: auth.licenseKey }
    : { model: "claude-sonnet-4-20250514", max_tokens: 4000, messages };
  const r = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  return r.json();
}

// Send email via YOUR backend → Resend → recipient's inbox
// Uses customer's own Gmail (verified in Resend)
async function sendViaResend(auth, toEmail, subject, body) {
  if (!SEND_URL) throw new Error("Backend not deployed yet. Deploy to Vercel first.");
  if (!auth.resendKey) throw new Error("No Resend API key. Add in Settings.");
  if (!auth.fromEmail) throw new Error("No From Email. Add in Settings.");
  const r = await fetch(SEND_URL, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ license_key: auth.licenseKey||"LOCAL", resend_api_key: auth.resendKey, from_email: auth.fromEmail, to_email: toEmail, subject, body }),
  });
  const d = await r.json();
  if (!d.success) throw new Error(d.error||"Send failed");
  return d;
}

function parseJSON(data) {
  const text = data.content.map(i=>i.text||"").join("");
  return JSON.parse(text.replace(/```json|```/g,"").trim());
}

// ── SHARED UI ─────────────────────────────────────────────────────────────────
function Tag({children,color="gray"}) {
  const c={green:"bg-emerald-900/40 text-emerald-400 border-emerald-700",yellow:"bg-amber-900/40 text-amber-400 border-amber-700",blue:"bg-blue-900/40 text-blue-400 border-blue-700",orange:"bg-orange-900/40 text-orange-400 border-orange-700",red:"bg-red-900/40 text-red-400 border-red-700",gray:"bg-zinc-800 text-zinc-400 border-zinc-600"};
  return <span className={`text-xs px-2 py-0.5 rounded border ${c[color]}`}>{children}</span>;
}
function Inp({label,value,onChange,placeholder,type="text",hint,rows}) {
  const cls="w-full bg-zinc-900 border border-zinc-700 focus:border-orange-500 text-white rounded-lg px-3 py-2 text-sm placeholder-zinc-600 outline-none transition-colors";
  return (
    <div>
      {label&&<label className="text-xs text-zinc-400 mb-1 block">{label}</label>}
      {rows?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} className={cls+" resize-none"}/>:<input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={type} className={cls}/>}
      {hint&&<p className="text-zinc-600 text-xs mt-1">{hint}</p>}
    </div>
  );
}
function Card({children,highlight,onClick}) {
  return <div onClick={onClick} className={`bg-zinc-800 border rounded-xl p-4 ${highlight?"border-orange-500/40":"border-zinc-700"} ${onClick?"cursor-pointer":""}`}>{children}</div>;
}
function Warn({children,type="warn"}) {
  const s=type==="error"?"bg-red-900/20 border-red-700/50 text-red-400":"bg-amber-900/20 border-amber-700/50 text-amber-400";
  return <div className={`border rounded-xl px-4 py-3 ${s}`}><p className="text-xs">{children}</p></div>;
}
function Box({title,children}) {
  return (
    <div className="bg-zinc-800/60 border border-zinc-700 rounded-2xl p-4 space-y-3">
      <p className="text-zinc-500 text-xs uppercase tracking-wider font-semibold border-b border-zinc-700 pb-2">{title}</p>
      {children}
    </div>
  );
}

// ── ONBOARDING ────────────────────────────────────────────────────────────────
function Onboarding({onActivate}) {
  const [step,setStep]=useState(0);
  const [f,setF]=useState({senderName:"",senderCity:"",demoUrl:"",apiKey:"",resendKey:"",fromEmail:""});
  const up=k=>v=>setF(p=>({...p,[k]:v}));
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const verifyAndFinish=async()=>{
    if(!f.senderName){setError("Enter your name.");return;}
    if(!f.senderCity){setError("Enter your city.");return;}
    if(!f.apiKey.startsWith("sk-ant-")){setError("API key should start with sk-ant-");return;}
    setLoading(true);setError("");
    try{
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:10,messages:[{role:"user",content:"hi"}]})});
      const d=await r.json();
      if(d.error){setError("API key rejected: "+d.error.message);setLoading(false);return;}
      onActivate({...f,mode:"local"});
    }catch{setError("Cannot verify. Check internet.");}
    setLoading(false);
  };

  if(step===0) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-10">
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-3xl font-bold text-white mx-auto mb-4 shadow-lg shadow-orange-500/20">⚡</div>
          <h1 className="text-2xl font-bold text-white">OutreachPro</h1>
          <p className="text-zinc-400 text-sm mt-1">AI cold email system for web designers</p>
        </div>
        <div className="space-y-2">
          {[["🤖","AI generates up to 20 leads at once"],["📧","Auto-sends emails from your Gmail"],["📊","Tracks all leads and follow-ups"],["🔄","Follow-up reminders at 2, 5, 10 days"]].map(([icon,text])=>(
            <div key={text} className="flex items-center gap-3 bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3">
              <span className="text-xl">{icon}</span><p className="text-zinc-300 text-sm">{text}</p>
            </div>
          ))}
        </div>
        <button onClick={()=>setStep(1)} className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 rounded-xl text-sm transition-colors shadow-lg shadow-orange-500/20">Get Started →</button>
        <p className="text-zinc-700 text-xs text-center">OutreachPro v{APP_VERSION}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-10">
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center mb-2">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-xl font-bold text-white mx-auto mb-2">⚡</div>
          <h1 className="text-xl font-bold text-white">Setup OutreachPro</h1>
        </div>

        <Box title="Your Profile">
          <div className="grid grid-cols-2 gap-3">
            <Inp label="Your Name *" value={f.senderName} onChange={up("senderName")} placeholder="Akash"/>
            <Inp label="Your City *" value={f.senderCity} onChange={up("senderCity")} placeholder="Jalore"/>
          </div>
          <Inp label="Demo Website URL" value={f.demoUrl} onChange={up("demoUrl")} placeholder="https://yourdemo.netlify.app" hint="Clients see this in emails. Can add later."/>
        </Box>

        <Box title="Anthropic API Key (for AI)">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 space-y-1">
            <p className="text-zinc-400 text-xs font-semibold">How to get:</p>
            <p className="text-zinc-500 text-xs">1. Open <span className="text-orange-400">console.anthropic.com</span></p>
            <p className="text-zinc-500 text-xs">2. Sign up → API Keys → Create Key</p>
            <p className="text-zinc-500 text-xs">3. Copy & paste below</p>
          </div>
          <Inp label="API Key *" value={f.apiKey} onChange={up("apiKey")} placeholder="sk-ant-api03-..." type="password" hint="🔒 Stored only in your browser"/>
        </Box>

        <Box title="Resend Email (for auto-send)">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 space-y-1">
            <p className="text-zinc-400 text-xs font-semibold">How to get free Resend API key:</p>
            <p className="text-zinc-500 text-xs">1. Open <span className="text-orange-400">resend.com</span> → Sign up free</p>
            <p className="text-zinc-500 text-xs">2. Go to API Keys → Create API Key</p>
            <p className="text-zinc-500 text-xs">3. Go to Domains → Add → click "Add email address" → enter your Gmail</p>
            <p className="text-zinc-500 text-xs">4. Check Gmail inbox → click verification link</p>
            <p className="text-zinc-500 text-xs">5. Paste both below</p>
          </div>
          <Inp label="Resend API Key *" value={f.resendKey} onChange={up("resendKey")} placeholder="re_xxxxxxxxxxxxxxxxx" type="password" hint="From resend.com → API Keys"/>
          <Inp label="From Email *" value={f.fromEmail} onChange={up("fromEmail")} placeholder="as5886675@gmail.com" hint="Your Gmail — must be verified in Resend"/>
        </Box>

        {error&&<Warn type="error">{error}</Warn>}

        <button onClick={verifyAndFinish} disabled={loading} className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors shadow-lg shadow-orange-500/20">
          {loading?"Verifying API Key...":"Activate & Start →"}
        </button>
        <p className="text-zinc-600 text-xs text-center">Resend & email can be added later in Settings</p>
      </div>
    </div>
  );
}

// ── SEND EMAILS ───────────────────────────────────────────────────────────────
function SendEmails({auth,setLeads}) {
  const [city,setCity]=useState("");
  const [type,setType]=useState("clinic");
  const [count,setCount]=useState(10);
  const [batchLeads,setBatchLeads]=useState([]);
  const [step,setStep]=useState("idle");
  const [sendStatus,setSendStatus]=useState({});
  const [progress,setProgress]=useState(0);
  const [totalSent,setTotalSent]=useState(0);
  const [dailySent,setDailySent]=useState(store.daily.get());
  const [csvMode,setCsvMode]=useState(false);
  const [csvText,setCsvText]=useState("");
  const [totalGenerated,setTotalGenerated]=useState(0);
  const DAILY_LIMIT=100;
  const canAutoSend=!!(auth.resendKey&&auth.fromEmail&&SEND_URL);
  const demoUrl=auth.demoUrl||"https://yourdemo.netlify.app";

  const parseCsv=()=>csvText.trim().split("\n").filter(Boolean).map((line,i)=>{
    const [name,email,c,btype]=line.split(",").map(s=>s.trim());
    const t=(btype||"clinic").toLowerCase().includes("rest")?"restaurant":"clinic";
    const tmpl=TEMPLATES[t];
    return {id:`csv_${i}`,name:name||"Business",email:email||"",city:c||city,type:t,
      subject:tmpl.subject(name),body:tmpl.body(name,c||city,auth.senderName,auth.senderCity,demoUrl)};
  }).filter(l=>l.email.includes("@"));

  const run=async()=>{
    if(dailySent>=DAILY_LIMIT){alert(`Daily limit of ${DAILY_LIMIT} reached. Try tomorrow.`);return;}
    setStep("generating");setBatchLeads([]);setSendStatus({});setProgress(0);setTotalGenerated(0);
    try{
      let bizList=[];
      if(csvMode){
        bizList=parseCsv();
        if(!bizList.length){setStep("idle");alert("No valid emails found.\nFormat: Name, email, city, type");return;}
      }else{
        // Generate in batches of MAX_LEADS_PER_BATCH
        const remaining=Math.min(count,100);
        const batches=Math.ceil(remaining/MAX_LEADS_PER_BATCH);
        for(let b=0;b<batches;b++){
          const batchCount=Math.min(MAX_LEADS_PER_BATCH,remaining-(b*MAX_LEADS_PER_BATCH));
          const data=await callClaude([{role:"user",content:`Generate ${batchCount} realistic fictional ${type} businesses in ${city||"Jalore, Rajasthan, India"} without websites. Make them all different from each other. Return ONLY a JSON array with fields: name, email, city, type, notes. Realistic Indian business names and gmail addresses. No markdown. No explanation.`}],auth);
          const batch=parseJSON(data);
          bizList=[...bizList,...batch];
          setTotalGenerated(bizList.length);
        }
      }
      const withEmails=bizList.slice(0,count).map(biz=>{
        const tmpl=TEMPLATES[biz.type]||TEMPLATES.clinic;
        return {...biz,id:Math.random().toString(36).slice(2),
          subject:tmpl.subject(biz.name),
          body:tmpl.body(biz.name,biz.city||city,auth.senderName,auth.senderCity,demoUrl)};
      });
      setBatchLeads(withEmails);
      const s={};withEmails.forEach((_,i)=>s[i]="pending");
      setSendStatus(s);setStep("previewing");
    }catch(e){setStep("idle");alert("Failed to generate: "+e.message);}
  };

  const sendAll=async()=>{
    if(!canAutoSend){
      alert("Auto-send needs:\n1. Resend API key\n2. Verified Gmail in Resend\n3. Backend deployed on Vercel\n\nFor now use Gmail button.");
      return;
    }
    setStep("sending");
    let sent=0;
    for(let i=0;i<batchLeads.length;i++){
      if(dailySent+sent>=DAILY_LIMIT){setSendStatus(p=>({...p,[i]:"skipped"}));continue;}
      const lead=batchLeads[i];
      setSendStatus(p=>({...p,[i]:"sending"}));
      try{
        await sendViaResend(auth,lead.email,lead.subject,lead.body);
        setSendStatus(p=>({...p,[i]:"sent"}));
        sent++;
        setProgress(Math.round(((i+1)/batchLeads.length)*100));
        setLeads(prev=>{
          const u=[...prev,{id:Date.now()+i,name:lead.name,email:lead.email,type:lead.type,
            city:lead.city||city,subject:lead.subject,sentAt:new Date().toISOString(),status:"sent",followUps:[]}];
          store.leads.set(u);return u;
        });
      }catch(e){setSendStatus(p=>({...p,[i]:"error"}));}
      if(i<batchLeads.length-1)await new Promise(r=>setTimeout(r,800));
    }
    store.daily.inc(sent);setDailySent(store.daily.get());
    setTotalSent(sent);setStep("done");
  };

  const openGmailAll=()=>{
    batchLeads.forEach((lead,i)=>{
      setTimeout(()=>{
        window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(lead.subject)}&body=${encodeURIComponent(lead.body)}`,"_blank");
      },i*500);
    });
    batchLeads.forEach((lead,i)=>{
      setTimeout(()=>{
        setLeads(prev=>{
          const u=[...prev,{id:Date.now()+i,name:lead.name,email:lead.email,type:lead.type,
            city:lead.city||city,subject:lead.subject,sentAt:new Date().toISOString(),status:"sent",followUps:[]}];
          store.leads.set(u);return u;
        });
      },(batchLeads.length*500)+100);
    });
    setSendStatus(()=>{const s={};batchLeads.forEach((_,i)=>s[i]="sent");return s;});
    store.daily.inc(batchLeads.length);setDailySent(store.daily.get());
    setTotalSent(batchLeads.length);setStep("done");
  };

  const reset=()=>{setStep("idle");setBatchLeads([]);setSendStatus({});setProgress(0);setTotalSent(0);};
  const icon={pending:"⏸",sending:"⏳",sent:"✅",error:"❌",skipped:"⏭"};

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Email Blast</h2>
          <p className="text-zinc-400 text-sm mt-0.5">{canAutoSend?"✅ Auto-send ready":"⚠️ Deploy backend for auto-send"}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-white font-bold text-sm">{dailySent}<span className="text-zinc-500 font-normal">/{DAILY_LIMIT}</span></p>
          <p className="text-zinc-500 text-xs">today</p>
        </div>
      </div>

      {dailySent>=DAILY_LIMIT&&<Warn>⚠️ Daily limit reached. Resets at midnight.</Warn>}
      {!auth.demoUrl&&<Warn>⚠️ No demo URL set. Go to Settings to add it.</Warn>}
      {!SEND_URL&&<Warn>⚠️ Backend not deployed. Auto-send won't work. Deploy to Vercel first.</Warn>}

      {(step==="idle"||step==="generating")&&(
        <>
          <div className="flex gap-2">
            <button onClick={()=>setCsvMode(false)} className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${!csvMode?"bg-orange-500 border-orange-500 text-white":"bg-zinc-800 border-zinc-700 text-zinc-400"}`}>🤖 AI Generate</button>
            <button onClick={()=>setCsvMode(true)} className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${csvMode?"bg-orange-500 border-orange-500 text-white":"bg-zinc-800 border-zinc-700 text-zinc-400"}`}>📋 Paste CSV</button>
          </div>

          {!csvMode?(
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Business Type</label>
                  <select value={type} onChange={e=>setType(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm">
                    <option value="clinic">Clinic / Hospital</option>
                    <option value="restaurant">Restaurant / Dhaba</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">City</label>
                  <input value={city} onChange={e=>setCity(e.target.value)} placeholder="e.g. Jalore" className="w-full bg-zinc-800 border border-zinc-700 focus:border-orange-500 text-white rounded-lg px-3 py-2 text-sm placeholder-zinc-600 outline-none"/>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Number of Leads: <span className="text-orange-400 font-bold">{count}</span></label>
                <input type="range" min="5" max="100" step="5" value={count} onChange={e=>setCount(parseInt(e.target.value))}
                  className="w-full accent-orange-500"/>
                <div className="flex justify-between text-zinc-600 text-xs mt-1">
                  <span>5</span><span>25</span><span>50</span><span>75</span><span>100</span>
                </div>
                {count>20&&<p className="text-amber-400 text-xs mt-1">⚠️ {Math.ceil(count/20)} AI calls needed. Takes ~{Math.ceil(count/20)*8} seconds.</p>}
              </div>
            </div>
          ):(
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Paste leads — one per line</label>
              <textarea value={csvText} onChange={e=>setCsvText(e.target.value)} rows={7}
                placeholder={"Ekdant Dental, ekdant@gmail.com, Jalore, clinic\nSharma Restaurant, sharma@gmail.com, Jodhpur, restaurant"}
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm placeholder-zinc-600 outline-none resize-none font-mono"/>
              <p className="text-zinc-600 text-xs mt-1">Format: Name, email, city, type (clinic/restaurant)</p>
            </div>
          )}

          <button onClick={run} disabled={step==="generating"||dailySent>=DAILY_LIMIT}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors shadow-lg shadow-orange-500/20">
            {step==="generating"
              ?<span className="flex items-center justify-center gap-2"><span className="animate-spin">⚙️</span>{totalGenerated>0?`Generated ${totalGenerated} so far...`:"Generating leads & writing emails..."}</span>
              :`⚡ Generate ${count} Leads & Write Emails`}
          </button>
        </>
      )}

      {step==="previewing"&&(
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-white font-semibold">{batchLeads.length} leads ready to send</p>
            <button onClick={reset} className="text-zinc-500 text-xs hover:text-zinc-300">✕ Reset</button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {batchLeads.map((lead,i)=>(
              <div key={i} className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{lead.name}</p>
                  <p className="text-zinc-400 text-xs truncate">{lead.email}</p>
                </div>
                <Tag>ready</Tag>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {canAutoSend&&(
              <button onClick={sendAll} className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 rounded-xl text-sm transition-colors shadow-lg shadow-orange-500/20">
                🚀 Auto-Send All {batchLeads.length} Emails
              </button>
            )}
            <button onClick={openGmailAll} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-sm transition-colors">
              📧 Open Gmail for All {batchLeads.length}
            </button>
            {!canAutoSend&&<p className="text-zinc-600 text-xs text-center">Deploy backend to Vercel to enable auto-send.</p>}
          </div>
        </div>
      )}

      {step==="sending"&&(
        <div className="space-y-4">
          <Card>
            <div className="text-center">
              <div className="text-3xl mb-2 animate-bounce">📨</div>
              <p className="text-white font-semibold">Sending emails...</p>
              <p className="text-zinc-400 text-sm mt-1">{Math.round(progress*batchLeads.length/100)} of {batchLeads.length} sent</p>
              <div className="mt-3 bg-zinc-700 rounded-full h-2.5"><div className="bg-orange-500 h-2.5 rounded-full transition-all duration-500" style={{width:`${progress}%`}}/></div>
              <p className="text-zinc-500 text-xs mt-2">{progress}%</p>
            </div>
          </Card>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {batchLeads.map((lead,i)=>(
              <div key={i} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg px-3 py-2">
                <span className="text-sm">{icon[sendStatus[i]]||"⏸"}</span>
                <p className="text-white text-xs flex-1 truncate">{lead.name}</p>
                <p className="text-zinc-500 text-xs truncate max-w-[120px]">{lead.email}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {step==="done"&&(
        <div className="space-y-4">
          <Card>
            <div className="text-center">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-white font-bold text-xl">{totalSent} emails sent!</p>
              <p className="text-zinc-400 text-sm mt-1">All added to your tracker automatically.</p>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="bg-zinc-900 rounded-lg p-3"><p className="text-emerald-400 font-bold text-lg">{totalSent}</p><p className="text-zinc-500 text-xs">Sent</p></div>
                <div className="bg-zinc-900 rounded-lg p-3"><p className="text-red-400 font-bold text-lg">{batchLeads.filter((_,i)=>sendStatus[i]==="error").length}</p><p className="text-zinc-500 text-xs">Failed</p></div>
                <div className="bg-zinc-900 rounded-lg p-3"><p className="text-zinc-400 font-bold text-lg">{DAILY_LIMIT-dailySent}</p><p className="text-zinc-500 text-xs">Left today</p></div>
              </div>
            </div>
          </Card>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {batchLeads.map((lead,i)=>(
              <div key={i} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg px-3 py-2">
                <span className="text-sm">{icon[sendStatus[i]]}</span>
                <p className="text-white text-xs flex-1 truncate">{lead.name}</p>
                <p className="text-zinc-500 text-xs truncate max-w-[120px]">{lead.email}</p>
              </div>
            ))}
          </div>
          <button onClick={run} className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">⚡ Generate Another Batch</button>
          <button onClick={reset} className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">🔄 Start Fresh</button>
        </div>
      )}
    </div>
  );
}

// ── COMPOSE ───────────────────────────────────────────────────────────────────
function ComposeEmail({leads,setLeads,auth}) {
  const [biz,setBiz]=useState({name:"",type:"clinic",city:"",email:"",notes:""});
  const [email,setEmail]=useState({subject:"",body:""});
  const [loading,setLoading]=useState(false);
  const [status,setStatus]=useState("");
  const [aiMode,setAiMode]=useState(false);
  const demoUrl=auth.demoUrl||"https://yourdemo.netlify.app";

  const generate=async()=>{
    const tmpl=TEMPLATES[biz.type]||TEMPLATES.clinic;
    const base={subject:tmpl.subject(biz.name),body:tmpl.body(biz.name,biz.city,auth.senderName,auth.senderCity,demoUrl)};
    if(!aiMode){setEmail(base);return;}
    setLoading(true);
    try{
      const data=await callClaude([{role:"user",content:`Personalize this cold email for ${biz.name} (${biz.type}) in ${biz.city}. Notes: ${biz.notes||"none"}. Sender: ${auth.senderName} from ${auth.senderCity}. Keep demo: ${demoUrl}. Pay after delivery. Return ONLY JSON {"subject":"...","body":"..."}.\n\nBase subject: ${base.subject}\nBase body: ${base.body}`}],auth);
      setEmail(parseJSON(data));
    }catch{setEmail(base);}
    setLoading(false);
  };

  const track=()=>{
    setLeads(p=>{const u=[{id:Date.now(),name:biz.name,email:biz.email,type:biz.type,city:biz.city,subject:email.subject,sentAt:new Date().toISOString(),status:"sent",followUps:[]},...p];store.leads.set(u);return u;});
  };

  const sendNow=async()=>{
    setStatus("sending");
    try{await sendViaResend(auth,biz.email,email.subject,email.body);track();setStatus("sent");setTimeout(()=>setStatus(""),3000);}
    catch(e){alert("Send failed: "+e.message);setStatus("");}
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Single Email</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Inp label="Business Name *" value={biz.name} onChange={v=>setBiz(p=>({...p,name:v}))} placeholder="Ekdant Dental"/></div>
        <Inp label="Their Email *" value={biz.email} onChange={v=>setBiz(p=>({...p,email:v}))} placeholder="clinic@gmail.com"/>
        <Inp label="City" value={biz.city} onChange={v=>setBiz(p=>({...p,city:v}))} placeholder="Jalore"/>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Type</label>
          <select value={biz.type} onChange={e=>setBiz(p=>({...p,type:e.target.value}))} className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm">
            <option value="clinic">Clinic</option><option value="restaurant">Restaurant</option>
          </select>
        </div>
        <Inp label="Notes (for AI)" value={biz.notes} onChange={v=>setBiz(p=>({...p,notes:v}))} placeholder="e.g. 2 doctors"/>
      </div>
      <div className="flex gap-3">
        <button onClick={generate} disabled={!biz.name||loading} className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
          {loading?"Generating...":"✨ Generate Email"}
        </button>
        <label className="flex items-center gap-2 cursor-pointer" onClick={()=>setAiMode(!aiMode)}>
          <div className={`w-10 h-5 rounded-full relative transition-colors ${aiMode?"bg-orange-500":"bg-zinc-600"}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${aiMode?"left-5":"left-0.5"}`}/></div>
          <span className="text-xs text-zinc-400">AI</span>
        </label>
      </div>
      {email.subject&&(
        <Card>
          <div className="space-y-3">
            <Inp label="Subject" value={email.subject} onChange={v=>setEmail(p=>({...p,subject:v}))}/>
            <Inp label="Body" value={email.body} onChange={v=>setEmail(p=>({...p,body:v}))} rows={10}/>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={sendNow} disabled={status==="sending"||!SEND_URL}
                className="col-span-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-lg transition-colors">
                {status==="sending"?"⏳ Sending...":status==="sent"?"✅ Sent!":"🚀 Send Now"}
              </button>
              <button onClick={()=>window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(biz.email)}&su=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`,"_blank")}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors">📧 Gmail</button>
              <button onClick={()=>{navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);}}
                className="bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold py-2 rounded-lg transition-colors">📋 Copy</button>
              <button onClick={()=>{track();}} className="col-span-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold py-2 rounded-lg transition-colors">📌 Mark Sent & Track</button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── TRACKER ───────────────────────────────────────────────────────────────────
function Tracker({leads,setLeads}) {
  const [filter,setFilter]=useState("all");
  const statuses=["sent","replied","interested","ignored","closed"];
  const statusColor={sent:"blue",replied:"green",closed:"green",ignored:"gray",interested:"yellow"};
  const filtered=filter==="all"?leads:leads.filter(l=>l.status===filter);

  if(!leads.length) return (
    <div className="text-center py-16 text-zinc-500"><div className="text-5xl mb-3">📭</div><p className="text-sm font-medium text-zinc-400">No leads yet</p><p className="text-xs mt-1">Use "Send" tab to get started.</p></div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Tracker</h2>
        <span className="text-zinc-500 text-xs">{leads.length} total</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[["Sent","sent","text-blue-400"],["Interested","interested","text-amber-400"],["Closed","closed","text-emerald-400"]].map(([l,k,c])=>(
          <button key={k} onClick={()=>setFilter(filter===k?"all":k)} className={`rounded-xl p-3 text-center border transition-colors ${filter===k?"border-orange-500 bg-orange-900/10":"border-zinc-700 bg-zinc-800"}`}>
            <div className={`text-xl font-bold ${c}`}>{leads.filter(x=>x.status===k).length}</div>
            <div className="text-xs text-zinc-500">{l}</div>
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {["all",...statuses].map(s=>(
          <button key={s} onClick={()=>setFilter(s)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filter===s?"bg-orange-500 border-orange-500 text-white":"bg-zinc-800 border-zinc-700 text-zinc-400"}`}>{s}</button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map(lead=>(
          <Card key={lead.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white text-sm">{lead.name}</span>
                  <Tag color={statusColor[lead.status]||"gray"}>{lead.status}</Tag>
                </div>
                <p className="text-zinc-400 text-xs mt-0.5 truncate">{lead.email}</p>
                <p className="text-zinc-600 text-xs">{new Date(lead.sentAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"})} · {(lead.followUps||[]).length} follow-ups</p>
              </div>
              <button onClick={()=>{setLeads(p=>{const u=p.filter(l=>l.id!==lead.id);store.leads.set(u);return u;})}} className="text-zinc-600 hover:text-red-400 text-xs shrink-0">✕</button>
            </div>
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {statuses.map(s=>(
                <button key={s} onClick={()=>setLeads(p=>{const u=p.map(l=>l.id===lead.id?{...l,status:s}:l);store.leads.set(u);return u;})}
                  className={`text-xs px-2 py-1 rounded-md border transition-colors ${lead.status===s?"bg-orange-500 border-orange-500 text-white":"bg-zinc-900 border-zinc-600 text-zinc-400 hover:border-zinc-400"}`}>
                  {s}
                </button>
              ))}
            </div>
          </Card>
        ))}
        {!filtered.length&&<p className="text-zinc-600 text-sm text-center py-4">No leads with "{filter}" status</p>}
      </div>
    </div>
  );
}

// ── FOLLOW-UPS ─────────────────────────────────────────────────────────────────
function FollowUps({leads,setLeads,auth}) {
  const [generating,setGenerating]=useState(null);
  const [fuTexts,setFuTexts]=useState({});
  const [sending,setSending]=useState(null);
  const demoUrl=auth.demoUrl||"https://yourdemo.netlify.app";
  const getDays=d=>Math.floor((Date.now()-new Date(d).getTime())/86400000);
  const canAutoSend=!!(auth.resendKey&&auth.fromEmail&&SEND_URL);

  const needsFU=leads.filter(l=>{
    if(["ignored","closed"].includes(l.status))return false;
    const d=getDays(l.sentAt),fc=(l.followUps||[]).length;
    return(fc===0&&d>=2)||(fc===1&&d>=5)||(fc===2&&d>=10);
  });

  const generate=async lead=>{
    setGenerating(lead.id);
    const fuNum=(lead.followUps||[]).length+1;
    try{
      const data=await callClaude([{role:"user",content:`Write follow-up #${fuNum} from ${auth.senderName} (web designer, ${auth.senderCity}) to ${lead.name} (${lead.type||"business"}) about building their website. Brief, friendly, not pushy. Reference earlier email. Demo: ${demoUrl}. Pay after delivery. Return ONLY JSON {"subject":"...","body":"..."}.`}],auth);
      setFuTexts(p=>({...p,[lead.id]:parseJSON(data)}));
    }catch{}
    setGenerating(null);
  };

  const sendFU=async lead=>{
    const fu=fuTexts[lead.id];if(!fu)return;
    setSending(lead.id);
    try{
      if(canAutoSend){await sendViaResend(auth,lead.email,fu.subject,fu.body);}
      else{window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(fu.subject)}&body=${encodeURIComponent(fu.body)}`,"_blank");}
      setLeads(p=>{const u=p.map(l=>l.id===lead.id?{...l,followUps:[...(l.followUps||[]),{sentAt:new Date().toISOString()}]}:l);store.leads.set(u);return u;});
      setFuTexts(p=>{const n={...p};delete n[lead.id];return n;});
    }catch(e){alert("Send failed: "+e.message);}
    setSending(null);
  };

  if(!leads.length) return <div className="text-center py-16 text-zinc-500"><div className="text-5xl mb-3">⏰</div><p className="text-sm font-medium text-zinc-400">No leads yet</p><p className="text-xs mt-1">Follow-up reminders appear at 2, 5, and 10 days.</p></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Follow-ups</h2>
        {needsFU.length>0&&<span className="bg-orange-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">{needsFU.length} due</span>}
      </div>
      {!needsFU.length&&<Card><p className="text-zinc-400 text-sm text-center">✅ All caught up!</p><p className="text-zinc-500 text-xs text-center mt-1">Reminders at 2, 5, and 10 days after sending.</p></Card>}
      {needsFU.map(lead=>{
        const fu=fuTexts[lead.id];const fuNum=(lead.followUps||[]).length+1;
        return (
          <Card key={lead.id} highlight>
            <div className="flex items-start justify-between mb-3">
              <div><p className="font-semibold text-white text-sm">{lead.name}</p><p className="text-zinc-400 text-xs">{lead.email}</p><p className="text-orange-400 text-xs mt-0.5">Follow-up #{fuNum} · {getDays(lead.sentAt)} days ago</p></div>
              <Tag color="yellow">Due</Tag>
            </div>
            {!fu?(
              <button onClick={()=>generate(lead)} disabled={generating===lead.id} className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                {generating===lead.id?"Writing...":"✨ Generate Follow-up"}
              </button>
            ):(
              <div className="space-y-2">
                <div className="bg-zinc-900 rounded-lg p-3"><p className="text-zinc-500 text-xs mb-1">Subject</p><p className="text-white text-xs">{fu.subject}</p></div>
                <div className="bg-zinc-900 rounded-lg p-3"><p className="text-zinc-500 text-xs mb-1">Body</p><p className="text-zinc-300 text-xs whitespace-pre-wrap leading-relaxed">{fu.body}</p></div>
                <button onClick={()=>sendFU(lead)} disabled={sending===lead.id} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                  {sending===lead.id?"⏳ Sending...":canAutoSend?"🚀 Send Now":"📧 Open Gmail"}
                </button>
              </div>
            )}
          </Card>
        );
      })}
      {leads.filter(l=>!needsFU.find(n=>n.id===l.id)&&!["ignored","closed"].includes(l.status)).length>0&&(
        <div>
          <p className="text-xs text-zinc-500 mb-2 mt-2">Waiting</p>
          {leads.filter(l=>!needsFU.find(n=>n.id===l.id)&&!["ignored","closed"].includes(l.status)).map(lead=>(
            <div key={lead.id} className="bg-zinc-800/40 border border-zinc-700 rounded-xl p-3 mb-2 flex items-center justify-between">
              <div><p className="text-white text-sm">{lead.name}</p><p className="text-zinc-500 text-xs">{(lead.followUps||[]).length} follow-ups · {getDays(lead.sentAt)}d ago</p></div>
              <Tag color="gray">Waiting</Tag>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function Settings({auth,setAuth,leads,setLeads}) {
  const [form,setForm]=useState({...auth});
  const [saved,setSaved]=useState(false);
  const up=k=>v=>setForm(p=>({...p,[k]:v}));
  const save=()=>{setAuth(form);store.auth.set(form);setSaved(true);setTimeout(()=>setSaved(false),2500);};
  const clearLeads=()=>{if(!window.confirm("Delete ALL leads? Cannot be undone."))return;setLeads([]);store.leads.set([]);};

  const autoSendReady=!!(form.resendKey&&form.fromEmail&&SEND_URL);

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-white">Settings</h2>

      <Box title="Your Profile">
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Name" value={form.senderName||""} onChange={up("senderName")} placeholder="Akash"/>
          <Inp label="City" value={form.senderCity||""} onChange={up("senderCity")} placeholder="Jalore"/>
        </div>
        <Inp label="Demo Website URL" value={form.demoUrl||""} onChange={up("demoUrl")} placeholder="https://yourdemo.netlify.app" hint="This link appears in every email to clients"/>
      </Box>

      <Box title="Email Auto-Send (Resend + Gmail)">
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${autoSendReady?"bg-emerald-900/20 border-emerald-700":"bg-zinc-900 border-zinc-700"}`}>
          <span>{autoSendReady?"✅":"⚠️"}</span>
          <p className="text-xs text-zinc-400">{autoSendReady?"Auto-send configured! Emails go from your Gmail.":"Complete setup below to enable auto-send."}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 space-y-1">
          <p className="text-zinc-400 text-xs font-semibold">Setup (free, 5 min):</p>
          <p className="text-zinc-500 text-xs">1. Go to <span className="text-orange-400">resend.com</span> → sign up free</p>
          <p className="text-zinc-500 text-xs">2. API Keys → Create → copy key below</p>
          <p className="text-zinc-500 text-xs">3. Domains → Add → "Add email address" → your Gmail</p>
          <p className="text-zinc-500 text-xs">4. Check Gmail → click verification link</p>
          <p className="text-zinc-500 text-xs">5. Deploy backend to Vercel (see README)</p>
        </div>
        <Inp label="Resend API Key" value={form.resendKey||""} onChange={up("resendKey")} placeholder="re_xxxxxxxxxxxxxxxxx" type="password" hint="From resend.com → API Keys"/>
        <Inp label="From Email (your Gmail)" value={form.fromEmail||""} onChange={up("fromEmail")} placeholder="as5886675@gmail.com" hint="Must be verified in Resend dashboard"/>
        {!SEND_URL&&<Warn>Backend not deployed yet. Deploy to Vercel to enable auto-send. See outreachpro-backend folder.</Warn>}
      </Box>

      <Box title="Anthropic API Key">
        <Inp label="API Key" value={form.apiKey||""} onChange={up("apiKey")} placeholder="sk-ant-api03-..." type="password" hint="🔒 Stored only in your browser — console.anthropic.com"/>
      </Box>

      <Box title="Data">
        <div className="flex items-center justify-between">
          <div><p className="text-white text-sm">{leads.length} leads saved</p><p className="text-zinc-500 text-xs">Stays saved after refresh</p></div>
          <button onClick={clearLeads} className="text-red-400 text-xs border border-red-800 px-3 py-1.5 rounded-lg">Clear All</button>
        </div>
      </Box>

      <button onClick={save} className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 rounded-xl text-sm transition-colors shadow-lg shadow-orange-500/20">
        {saved?"✅ Settings Saved!":"Save Changes"}
      </button>
      <button onClick={()=>{if(window.confirm("Log out?")) {store.auth.set(null);localStorage.removeItem("op_auth");window.location.reload();}}}
        className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-medium py-2.5 rounded-xl text-sm transition-colors">
        Log Out
      </button>
      <p className="text-zinc-700 text-xs text-center pb-2">OutreachPro v{APP_VERSION}</p>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [auth,setAuth]=useState(null);
  const [activeTab,setActiveTab]=useState(0);
  const [leads,setLeads]=useState([]);
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    const a=store.auth.get();
    const l=store.leads.get();
    if(a)setAuth(a);
    if(l.length)setLeads(l);
    setReady(true);
  },[]);

  const followUpsDue=leads.filter(l=>{
    if(["ignored","closed"].includes(l.status))return false;
    const d=Math.floor((Date.now()-new Date(l.sentAt).getTime())/86400000),fc=(l.followUps||[]).length;
    return(fc===0&&d>=2)||(fc===1&&d>=5)||(fc===2&&d>=10);
  }).length;

  if(!ready)return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="text-orange-500 text-4xl animate-pulse">⚡</div></div>;
  if(!auth)return <Onboarding onActivate={a=>{setAuth(a);store.auth.set(a);}}/>;

  const icons=["📨","✍️","📊","⏰","⚙️"];

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-8" style={{fontFamily:"'DM Sans',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-sm font-bold shadow-md shadow-orange-500/30">⚡</div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-white text-base leading-tight">OutreachPro</h1>
            <p className="text-zinc-500 text-xs truncate">{auth.senderName} · {auth.senderCity}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-white font-bold text-sm">{leads.length}</div>
            <div className="text-zinc-600 text-xs">leads</div>
          </div>
        </div>
      </div>
      <div className="bg-zinc-900 border-b border-zinc-800 sticky top-[57px] z-10">
        <div className="max-w-lg mx-auto flex">
          {TABS.map((tab,i)=>(
            <button key={i} onClick={()=>setActiveTab(i)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors flex flex-col items-center gap-0.5 relative ${activeTab===i?"text-orange-400 border-b-2 border-orange-400":"text-zinc-500 hover:text-zinc-300"}`}>
              <span className="text-base leading-none">{icons[i]}</span>
              <span className="text-[10px]">{tab}</span>
              {tab==="Follow-ups"&&followUpsDue>0&&<span className="absolute top-1 right-1 bg-orange-500 text-white text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold">{followUpsDue}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 pt-5">
        {activeTab===0&&<SendEmails auth={auth} setLeads={setLeads}/>}
        {activeTab===1&&<ComposeEmail leads={leads} setLeads={setLeads} auth={auth}/>}
        {activeTab===2&&<Tracker leads={leads} setLeads={setLeads}/>}
        {activeTab===3&&<FollowUps leads={leads} setLeads={setLeads} auth={auth}/>}
        {activeTab===4&&<Settings auth={auth} setAuth={a=>{setAuth(a);store.auth.set(a);}} leads={leads} setLeads={setLeads}/>}
      </div>
    </div>
  );
}
