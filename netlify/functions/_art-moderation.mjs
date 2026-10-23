// Conservative submission triage. This is not image moderation or copyright verification.
const patterns=[
 ["threats",/\b(?:kill|murder|attack|hurt|injure)\s+(?:all\s+)?(?:you|them|people|a person)\b/i],
 ["hateful abuse",/\b(?:racial supremacy|ethnic cleansing|genocide advocacy)\b/i],
 ["malware or fraud",/\b(?:phishing|steal passwords|ransomware|malware)\b/i]
];
export function triageSubmission(fields){
 const text=fields.map(v=>String(v||"")).join(" ").slice(0,6500);
 const flags=patterns.filter(([,re])=>re.test(text)).map(([reason])=>reason);
 return {status:flags.length?"Flagged Review":"Pending Review",flags,auto_approved:false,checked_at:new Date().toISOString()};
}
export function mayPublish(record){
 return !!record?.moderation && record.moderation.flags.length===0 &&
 record.moderation.auto_approved===false && record.rights_confirmed===true;
}
