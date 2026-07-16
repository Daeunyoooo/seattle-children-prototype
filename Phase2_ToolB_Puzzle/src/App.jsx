import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { SHARED_GOAL } from './data.js'

/* STORAGE */

const LS = {
  goal:'wii.goal', sidebarOpen:'wii.sidebarOpen',
  selectedFilters:'wii.selectedFilters', outlineColorMode:'wii.outlineColorMode',
  textScale:'wii.textScale', pieceScale:'wii.pieceScale',
  drawings:'wii.drawings', photos:'wii.photos',
  activeFillId:'wii.activeFillId', activeFillType:'wii.activeFillType',
  goalOpacity:'wii.goalOpacity',
}
const loadLS = (k,fb) => { try{const r=window.localStorage.getItem(k);return r==null?fb:JSON.parse(r)}catch{return fb} }
const saveLS = (k,v) => { try{window.localStorage.setItem(k,JSON.stringify(v))}catch{} }
function usePersistedState(key,initial){
  const [v,setV]=useState(()=>loadLS(key,initial))
  useEffect(()=>saveLS(key,v),[key,v])
  return [v,setV]
}

/* THEME */

const P = {
  bg:'#fdf8f4', sidebar:'#fffefe', border:'#e8e0f0', accent:'#b094d8',
  accentLight:'#f0eafa', textMain:'#2d2a35', textMid:'#7a7090', textLight:'#b0a8c0',
  green:'#a8d4a8', greenText:'#2d6a3a', goalBorder:'#c8bce8',
  filterBg:'#faf7ff', filterBorder:'#b8a8e0',
}

/* STAKEHOLDER OUTLINE COLORS */

const STKHOLDER_OUTLINE = { patient:'#d04468', caregiver:'#c06828', clinician:'#2868c0', everyone:'#b08818', mixed:'#7050b8', default:'#c8bce8' }
function getStakeholderOutline(stakeholder) {
  const s=stakeholder.toLowerCase()
  if(s==='everyone') return STKHOLDER_OUTLINE.everyone
  const p=s.includes('patient'),c=s.includes('caregiver'),d=s.includes('clinician'),t=s.includes('team')
  if([p,c,d,t].filter(Boolean).length>1) return STKHOLDER_OUTLINE.mixed
  if(p) return STKHOLDER_OUTLINE.patient
  if(c) return STKHOLDER_OUTLINE.caregiver
  if(d||t) return STKHOLDER_OUTLINE.clinician
  return STKHOLDER_OUTLINE.default
}

/* DATA */

const TOOL_C_STAKEHOLDER_WHEELS = [
  {
    id:'toolc-caregiver-life-participation',
    label:'Life Participation',
    shortLabel:'Life Participation',
    stakeholder:'Caregiver',
    description:'Being able to do the things you love — school, friends, activities, and everything that makes life meaningful.',
    color:'#f7c5d5',
    angle:30,
    timeline:'Tool C default',
    targetDate:'Caregiver value',
    smartDetails:'Life Participation — Being able to do the things you love — school, friends, activities, and everything that makes life meaningful',
    category:'Tool C'
  },
  {
    id:'toolc-caregiver-survival',
    label:'Survival',
    shortLabel:'Survival',
    stakeholder:'Caregiver',
    description:'Reducing the risk of life-threatening complications.',
    color:'#f8c0b0',
    angle:70,
    timeline:'Tool C default',
    targetDate:'Caregiver value',
    smartDetails:'Survival — Reducing the risk of life-threatening complications',
    category:'Tool C'
  },
  {
    id:'toolb-caregiver-clinician-kidney-health',
    label:'Kidney Health',
    shortLabel:'Kidney Health',
    stakeholder:'Clinician & Caregiver',
    description:'Keeping your kidneys as healthy as they can be.',
    color:'#a0d8c8',
    angle:110,
    timeline:'Tool C default',
    targetDate:'Clinician & Caregiver value',
    smartDetails:'Kidney Health — Keeping your kidneys as healthy as they can be',
    category:'Tool C'
  },
  {
    id:'toolc-caregiver-preventing-infections',
    label:'Preventing Infections',
    shortLabel:'Prev. Infections',
    stakeholder:'Caregiver',
    description:'Protecting your body from getting sick, especially from infections that can be serious after a transplant.',
    color:'#f8d0b8',
    angle:150,
    timeline:'Tool C default',
    targetDate:'Caregiver value',
    smartDetails:'Preventing Infections — Protecting your body from getting sick, especially from infections that can be serious after a transplant',
    category:'Tool C'
  },
  {
    id:'toolc-clinician-what-matters',
    label:'What matters to you',
    shortLabel:'What Matters',
    stakeholder:'Clinician',
    description:'The things in your life that are most important to you.',
    color:'#fac894',
    angle:190,
    timeline:'Tool C default',
    targetDate:'Clinician value',
    smartDetails:'What matters to you — The things in your life that are most important to you',
    category:'Tool C'
  },
  {
    id:'toolc-clinician-preventing-harm',
    label:'Preventing harm',
    shortLabel:'Preventing Harm',
    stakeholder:'Clinician',
    description:'Keeping you safe from things that could hurt you or make you sicker.',
    color:'#a8d4f0',
    angle:230,
    timeline:'Tool C default',
    targetDate:'Clinician value',
    smartDetails:'Preventing harm — Keeping you safe from things that could hurt you or make you sicker',
    category:'Tool C'
  },
  {
    id:'toolc-clinician-blood-pressure-control',
    label:'Blood Pressure Control',
    shortLabel:'Blood Pressure',
    stakeholder:'Clinician',
    description:'Keeping your blood pressure at a level that protects your body.',
    color:'#a8d8a8',
    angle:310,
    timeline:'Tool C default',
    targetDate:'Clinician value',
    smartDetails:'Blood Pressure Control — Keeping your blood pressure at a level that protects your body',
    category:'Tool C'
  },
  {
    id:'toolc-clinician-long-term-survival',
    label:'Promoting long-term survival',
    shortLabel:'Long-term Survival',
    stakeholder:'Clinician',
    description:'Reducing the risk of life-threatening complications.',
    color:'#b8e4b8',
    angle:350,
    timeline:'Tool C default',
    targetDate:'Clinician value',
    smartDetails:'Promoting long-term survival — Reducing the risk of life-threatening complications',
    category:'Tool C'
  },
]

function normalizeYouthValues(youthValues){
  if (!Array.isArray(youthValues)) return null
  return youthValues
    .map((value,index)=>{
      const label=String(value.label||value.text||'').trim()
      if(!label) return null
      return {
        id:value.id||`phase2-youth-${index}`,
        label,
        shortLabel:label.length>18?`${label.slice(0,16)}...`:label,
        stakeholder:'Patient',
        description:value.description||label,
        color:['#f4a8b8','#fac894','#f8e4a0','#d0b8f0','#b8e4b8'][index%5],
        angle:(270+index*30)%360,
        timeline:'From Phase 1',
        targetDate:'Selected for Phase 2',
        smartDetails:label,
        category:'My Values',
      }
    })
    .filter(Boolean)
}
const normalizeValueLabel=label=>String(label||'').trim().replace(/\s+/g,' ').toLowerCase()
function mergeStakeholderLabels(...labels){
  const priority=['Clinician','Caregiver','Patient','Team','Everyone']
  const found=new Map()
  labels
    .filter(Boolean)
    .flatMap(label=>String(label).split(/\s*&\s*|\s*,\s*/))
    .map(label=>label.trim())
    .filter(Boolean)
    .forEach(label=>{
      const canonical=priority.find(item=>item.toLowerCase()===label.toLowerCase())||label
      found.set(canonical.toLowerCase(),canonical)
    })
  const ordered=priority.filter(item=>found.has(item.toLowerCase()))
  const extra=[...found.values()].filter(item=>!priority.some(p=>p.toLowerCase()===item.toLowerCase()))
  return [...ordered,...extra].join(' & ')
}
function mergeDuplicateValueWheels(wheels){
  const merged=[]
  const byLabel=new Map()
  wheels.forEach((wheel,index)=>{
    const key=normalizeValueLabel(wheel.label)
    if(!key) return
    if(!byLabel.has(key)){
      const copy={...wheel,originalIndexes:[index]}
      byLabel.set(key,copy)
      merged.push(copy)
      return
    }
    const existing=byLabel.get(key)
    existing.id=`${existing.id}-merged-${wheel.id}`
    existing.stakeholder=mergeStakeholderLabels(existing.stakeholder,wheel.stakeholder)
    existing.targetDate=mergeStakeholderLabels(existing.targetDate,wheel.targetDate)||existing.targetDate
    existing.description=existing.description||wheel.description
    existing.smartDetails=existing.smartDetails||wheel.smartDetails
    existing.originalIndexes.push(index)
  })
  return merged
}

function buildWheelLabels(youthValues){
  const defaults = [
    {id:'me-care',label:'Life Participation',shortLabel:'Life Participation',stakeholder:'Caregiver',description:'Being able to do the things you love — school, friends, activities, and everything that makes life meaningful.',color:'#f7c5d5',angle:0,timeline:'3 months',targetDate:'By August 2025',smartDetails:'Identify 3 activities the child can participate in weekly despite treatment schedule',category:'Life'},
    {id:'me',label:'Play soccer & travel',shortLabel:'Soccer & Travel',stakeholder:'Patient',description:'I want to be able to play sports and go on trips without being tied to a machine or feeling exhausted.',color:'#f4a8b8',angle:30,timeline:'6 months',targetDate:'By November 2025',smartDetails:'Increase energy levels to participate in sports 2x per week and take 1 trip',category:'Hobbies'},
    {id:'me-doc',label:'What Matters to You',shortLabel:'What Matters',stakeholder:'Patient & Clinician',description:'The things in your life that are most important to you — understanding your values to guide care decisions.',color:'#fac894',angle:60,timeline:'1 month',targetDate:'By June 2025',smartDetails:'Discuss and document top 3 personal priorities with the care team',category:'My Health'},
    {id:'doctor',label:'Preventing Harm',shortLabel:'Preventing Harm',stakeholder:'Clinician',description:'Keeping you safe from things that could hurt you or make you sicker — prioritizing safety in every care decision.',color:'#a8d4f0',angle:90,timeline:'Ongoing',targetDate:'Monthly check-ins',smartDetails:'Review and minimize risk factors at every clinical encounter',category:'My Health'},
    {id:'doc-both',label:'Blood Pressure Control',shortLabel:'Blood Pressure',stakeholder:'Clinician & Team',description:'Keeping your blood pressure at a level that protects your body and reduces the risk of complications.',color:'#a8d8a8',angle:120,timeline:'1 year',targetDate:'By May 2026',smartDetails:'Maintain blood pressure within target range at 90% of readings',category:'My Health'},
    {id:'both',label:'Less hospital visits',shortLabel:'Fewer Visits',stakeholder:'Everyone',description:'All of us want to maximize time at home and minimize the disruption caused by clinical appointments.',color:'#f8e4a0',angle:150,timeline:'6 months',targetDate:'By November 2025',smartDetails:'Reduce unplanned hospital visits from current baseline by 50%',category:'My Health'},
    {id:'both-care',label:'Survival',shortLabel:'Survival',stakeholder:'Caregiver & Team',description:'Reducing the risk of life-threatening complications and keeping your child as safe as possible.',color:'#a0d8c8',angle:180,timeline:'3 months',targetDate:'By August 2025',smartDetails:'Adhere to all follow-up appointments and emergency care protocols',category:'My Health'},
    {id:'caregiver',label:'Preventing Infections',shortLabel:'Prev. Infections',stakeholder:'Caregiver',description:'Protecting your body from getting sick, especially from infections that can be serious after a transplant.',color:'#f8c0b0',angle:210,timeline:'2 months',targetDate:'By July 2025',smartDetails:'Implement infection prevention protocols and maintain vaccination schedule',category:'My Health'},
    {id:'quality-life',label:'Quality of life',shortLabel:'Quality of Life',stakeholder:'Patient & Team',description:'Focus on maintaining and improving overall quality of life despite medical challenges.',color:'#d0b8f0',angle:240,timeline:'3 months',targetDate:'By August 2025',smartDetails:'Implement 3 quality-of-life improvement activities monthly',category:'Hobbies'},
    {id:'education',label:'Promoting Long-term Survival',shortLabel:'Long-term Survival',stakeholder:'Clinician & Patient',description:'Reducing the risk of life-threatening complications through proactive, evidence-based care.',color:'#b8e4b8',angle:270,timeline:'2 months',targetDate:'By July 2025',smartDetails:'Review long-term survival outcomes and align treatment plan accordingly',category:'My Health'},
    {id:'support-network',label:'Support network',shortLabel:'Support Network',stakeholder:'Everyone',description:'Build a strong collaborative team of family, clinicians, and care providers.',color:'#f8d0b8',angle:300,timeline:'1 month',targetDate:'By June 2025',smartDetails:'Hold bi-weekly team meetings with all stakeholders',category:'Support'},
    {id:'medication',label:'Kidney Health',shortLabel:'Kidney Health',stakeholder:'Clinician & Caregiver',description:'Keeping your kidneys as healthy as they can be through careful monitoring and treatment.',color:'#b0d8f4',angle:330,timeline:'Ongoing',targetDate:'Monthly reviews',smartDetails:'Maintain kidney function markers within target range with monthly labs',category:'My Health'},
  ]
  const selectedYouthValues=normalizeYouthValues(youthValues)
  if (!selectedYouthValues) return mergeDuplicateValueWheels(defaults)
  return mergeDuplicateValueWheels([...selectedYouthValues, ...TOOL_C_STAKEHOLDER_WHEELS])
}

/* STAKEHOLDER FILTERS */

const STAKEHOLDER_FILTERS=[
  {id:'patient',label:'What do I value?',matches:w=>w.stakeholder.toLowerCase().includes('patient')},
  {id:'caregiver',label:'What does my caregiver value?',matches:w=>w.stakeholder.toLowerCase().includes('caregiver')},
  {id:'clinician',label:'What does my clinician value?',matches:w=>w.stakeholder.toLowerCase().includes('clinician')},
]
const pieceMatchesFilters=(w,sf)=>sf.length===0||w.stakeholder.toLowerCase().includes('everyone')||STAKEHOLDER_FILTERS.filter(f=>sf.includes(f.id)).some(f=>f.matches(w))
const shortStakeholder=s=>s.replace('Patient','Me').replace(/\s*&\s*/g,', ')

/* JIGSAW PATH */

function jigsawPath(s,tE,rE,bE,lE){
  const th=s*.15,tw=s*.30,to=(s-tw)/2,te=to+tw
  let d='M 0 0 '
  if(tE==='flat')d+=`L ${s} 0 `;else{const dir=tE==='tab'?-1:1;d+=`L ${to} 0 C ${to} ${dir*th*.35} ${to+tw*.18} ${dir*th} ${to+tw*.5} ${dir*th} C ${to+tw*.82} ${dir*th} ${te} ${dir*th*.35} ${te} 0 L ${s} 0 `}
  if(rE==='flat')d+=`L ${s} ${s} `;else{const dir=rE==='tab'?1:-1;d+=`L ${s} ${to} C ${s+dir*th*.35} ${to} ${s+dir*th} ${to+tw*.18} ${s+dir*th} ${to+tw*.5} C ${s+dir*th} ${to+tw*.82} ${s+dir*th*.35} ${te} ${s} ${te} L ${s} ${s} `}
  if(bE==='flat')d+=`L 0 ${s} `;else{const dir=bE==='tab'?1:-1;d+=`L ${te} ${s} C ${te} ${s+dir*th*.35} ${to+tw*.82} ${s+dir*th} ${to+tw*.5} ${s+dir*th} C ${to+tw*.18} ${s+dir*th} ${to} ${s+dir*th*.35} ${to} ${s} L 0 ${s} `}
  if(lE==='flat')d+=`L 0 0 `;else{const dir=lE==='tab'?-1:1;d+=`L 0 ${te} C ${dir*th*.35} ${te} ${dir*th} ${to+tw*.82} ${dir*th} ${to+tw*.5} C ${dir*th} ${to+tw*.18} ${dir*th*.35} ${to} 0 ${to} L 0 0 `}
  return d+'Z'
}

function puzzleBoxPath(w,h,th,tw){
  const toX=(w-tw)/2,teX=toX+tw,toY=(h-tw)/2,teY=toY+tw
  let d='M 0 0 '
  d+=`L ${toX} 0 C ${toX} ${-th*.35} ${toX+tw*.18} ${-th} ${toX+tw*.5} ${-th} C ${toX+tw*.82} ${-th} ${teX} ${-th*.35} ${teX} 0 L ${w} 0 `
  d+=`L ${w} ${toY} C ${w+th*.35} ${toY} ${w+th} ${toY+tw*.18} ${w+th} ${toY+tw*.5} C ${w+th} ${toY+tw*.82} ${w+th*.35} ${teY} ${w} ${teY} L ${w} ${h} `
  d+=`L ${teX} ${h} C ${teX} ${h+th*.35} ${toX+tw*.82} ${h+th} ${toX+tw*.5} ${h+th} C ${toX+tw*.18} ${h+th} ${toX} ${h+th*.35} ${toX} ${h} L 0 ${h} `
  d+=`L 0 ${teY} C ${-th*.35} ${teY} ${-th} ${toY+tw*.82} ${-th} ${toY+tw*.5} C ${-th} ${toY+tw*.18} ${-th*.35} ${toY} 0 ${toY} L 0 0 Z`
  return d
}

function shade(hex,pct){
  const n=parseInt(hex.replace('#',''),16)
  const cl=v=>Math.max(0,Math.min(255,v+Math.round(2.55*pct)))
  const r=cl(n>>16),g=cl((n>>8)&0xff),b=cl(n&0xff)
  return `#${((r<<16)|(g<<8)|b).toString(16).padStart(6,'0')}`
}
const hexToRgb=hex=>{
  const n=parseInt(hex.replace('#',''),16)
  return {r:n>>16,g:(n>>8)&0xff,b:n&0xff}
}
const rgbToHex=({r,g,b})=>`#${((Math.round(r)<<16)|(Math.round(g)<<8)|Math.round(b)).toString(16).padStart(6,'0')}`
const mixRgb=(a,b,t)=>({r:a.r+(b.r-a.r)*t,g:a.g+(b.g-a.g)*t,b:a.b+(b.b-a.b)*t})
const lightenHex=(hex,amount)=>rgbToHex(mixRgb(hexToRgb(hex),hexToRgb('#FFFFFF'),amount))
const COLOR_WHEEL_STOPS=[
  {angle:0,color:'#69D0B2'},    // right-middle: teal / aqua
  {angle:45,color:'#67C8F4'},   // bottom-right: sky blue
  {angle:90,color:'#8E74E8'},   // bottom: soft violet
  {angle:135,color:'#EB5BAE'},  // bottom-left: hot pink
  {angle:180,color:'#F66C7E'},  // middle-left: coral pink
  {angle:225,color:'#F4B63C'},  // top-left: warm golden orange
  {angle:270,color:'#C9DB45'},  // upper-middle: yellow-green
  {angle:315,color:'#9FDE55'},  // top-right: fresh lime green
  {angle:337,color:'#7FD08A'}   // far top-right: mint green
].map(stop=>({...stop,rgb:hexToRgb(stop.color)}))
function getPositionColor(pos,gridSize){
  const x=gridSize<=1?0:pos.c/(gridSize-1)
  const y=gridSize<=1?0:pos.r/(gridSize-1)
  const angle=(Math.atan2(y-0.5,x-0.5)*180/Math.PI+360)%360
  const stops=COLOR_WHEEL_STOPS
  const currentIndex=stops.findIndex((stop,index)=>{
    const next=stops[(index+1)%stops.length]
    return stop.angle<=angle&&(angle<next.angle||next.angle<stop.angle)
  })
  const start=stops[currentIndex>=0?currentIndex:stops.length-1]
  const end=stops[(currentIndex>=0?currentIndex+1:0)%stops.length]
  const span=(end.angle-start.angle+360)%360||360
  const progress=(angle-start.angle+360)%360/span
  return rgbToHex(mixRgb(start.rgb,end.rgb,progress))
}

/* RECTANGULAR GRID */
const GOAL_CELL_SIZE=2
const cellKey=(r,c)=>`${r},${c}`
const hasCell=(validSet,r,c)=>validSet.has(cellKey(r,c))
const BASE_RECT_POS=[{r:0,c:0},{r:0,c:1},{r:0,c:2},{r:0,c:3},{r:1,c:0},{r:1,c:3},{r:2,c:0},{r:2,c:3},{r:3,c:0},{r:3,c:1},{r:3,c:2},{r:3,c:3}]
const outerRingCapacity=layer=>4*(4+layer*2)-4
function getOuterRingPositions(layer,baseOffset){
  const min=baseOffset-layer,max=baseOffset+3+layer
  const positions=[]
  for(let c=min;c<=max;c+=1) positions.push({r:min,c,tier:layer})
  for(let r=min+1;r<=max;r+=1) positions.push({r,c:max,tier:layer})
  for(let c=max-1;c>=min;c-=1) positions.push({r:max,c,tier:layer})
  for(let r=max-1;r>min;r-=1) positions.push({r,c:min,tier:layer})
  return positions
}
function getPuzzleLayout(count){
  let outerLayers=0,capacity=BASE_RECT_POS.length
  while(capacity<count){
    outerLayers+=1
    capacity+=outerRingCapacity(outerLayers)
  }
  const gridSize=4+outerLayers*2
  const baseOffset=outerLayers
  const goalRect={r:baseOffset+1,c:baseOffset+1,size:GOAL_CELL_SIZE}
  const positions=BASE_RECT_POS.map(pos=>({r:pos.r+baseOffset,c:pos.c+baseOffset,tier:0}))
  for(let layer=1;layer<=outerLayers;layer+=1){
    positions.push(...getOuterRingPositions(layer,baseOffset))
  }
  return {gridSize,goalRect,positions,validSet:new Set(positions.map(p=>cellKey(p.r,p.c)))}
}
function getRectEdges(r,c,validSet,gridSize){return{tE:r===0?'tab':hasCell(validSet,r-1,c)?'notch':'flat',bE:r===gridSize-1?'tab':hasCell(validSet,r+1,c)?'tab':'flat',lE:c===0?'tab':hasCell(validSet,r,c-1)?'notch':'flat',rE:c===gridSize-1?'tab':hasCell(validSet,r,c+1)?'tab':'flat'}}
const LIFE_KEYWORDS=['life','happiness','happy','joy','friend','friends','family','food','delicious','play','soccer','travel','school','activity','activities','hobby','hobbies','quality','time','meaningful','love','fun']
const CLINIC_KEYWORDS=['kidney','blood pressure','clinic','clinical','clinician','medical','medicine','infection','infections','medication','treatment','hospital','doctor','health','harm','safety','complication','complications']
const MIDDLE_KEYWORDS=['survival','survive','support','network','team','caregiver','everyone','together','shared','long-term','long term']
const keywordScore=(text,keywords)=>keywords.reduce((sum,keyword)=>sum+(text.includes(keyword)?1:0),0)
function getWheelLayoutRank(w,index){
  const text=[w.label,w.shortLabel,w.description,w.smartDetails,w.category,w.stakeholder].filter(Boolean).join(' ').toLowerCase()
  const life=keywordScore(text,LIFE_KEYWORDS)+(w.stakeholder?.toLowerCase().includes('patient')?0.3:0)
  const clinic=keywordScore(text,CLINIC_KEYWORDS)+(w.stakeholder?.toLowerCase().includes('clinician')?0.8:0)
  const middle=keywordScore(text,MIDDLE_KEYWORDS)
  const zone=middle>0&&!text.includes('kidney')&&!text.includes('blood pressure')?'middle':clinic>life?'clinic':life>clinic?'life':'middle'
  return {
    zone,
    index
  }
}
function getSemanticLayoutItems(wheels,layout){
  const center=(layout.gridSize-1)/2
  const slots=layout.positions.map((pos,layoutIndex)=>({
    ...pos,
    layoutIndex,
    tier:pos.tier||0,
    topLeft:pos.r+pos.c,
    bottomRight:(layout.gridSize-1-pos.r)+(layout.gridSize-1-pos.c),
    center:Math.abs(pos.r-center)+Math.abs(pos.c-center)
  }))
  const lifeItems=[],middleItems=[],clinicItems=[]
  wheels
    .map((w,index)=>({w,index,...getWheelLayoutRank(w,index)}))
    .forEach(item=>{
      if(item.zone==='life') lifeItems.push(item)
      else if(item.zone==='clinic') clinicItems.push(item)
      else middleItems.push(item)
    })
  const remaining=[...slots]
  const takeSlot=(sorter)=>{
    remaining.sort(sorter)
    return remaining.shift()
  }
  const placed=[]
  lifeItems.forEach(item=>placed.push({...item,pos:takeSlot((a,b)=>a.tier-b.tier||a.topLeft-b.topLeft||a.r-b.r||a.c-b.c)}))
  clinicItems.forEach(item=>placed.push({...item,pos:takeSlot((a,b)=>a.tier-b.tier||a.bottomRight-b.bottomRight||b.r-a.r||b.c-a.c)}))
  middleItems.forEach(item=>placed.push({...item,pos:takeSlot((a,b)=>a.tier-b.tier||a.center-b.center||a.topLeft-b.topLeft||a.r-b.r||a.c-b.c)}))
  return placed.sort((a,b)=>a.index-b.index)
}

/* SHARED COMPONENTS */
function HoverInfoCard({wheel}){
  return(
    <div style={{background:'white',borderRadius:'14px',padding:'18px',borderLeft:`5px solid ${wheel?.color??'transparent'}`,boxShadow:wheel?'0 8px 24px rgba(180,160,220,0.20)':'none',opacity:wheel?1:0,transition:'opacity 0.2s ease',pointerEvents:'none',overflow:'hidden'}}>
      {wheel&&<>
        <div style={{fontSize:'10px',textTransform:'uppercase',color:P.textMid,marginBottom:'4px',fontWeight:'700',letterSpacing:'0.5px'}}>{wheel.stakeholder}</div>
        <div style={{fontSize:'15px',fontWeight:'700',color:P.textMain,marginBottom:'8px',lineHeight:'1.3'}}>{wheel.label}</div>
        <div style={{fontSize:'12.5px',lineHeight:'1.6',color:'#4a4460'}}>{wheel.description}</div>
      </>}
    </div>
  )
}

function StakeholderFilterMenu({selectedFilters,onToggleFilter}){
  return(
    <div style={{background:P.filterBg,border:`2.5px solid ${P.filterBorder}`,borderRadius:'14px',padding:'15px 16px',boxShadow:'0 4px 14px rgba(180,160,220,0.14)'}}>
      <p style={{fontSize:'13px',color:P.textMid,marginBottom:'10px',fontWeight:'600',textAlign:'center',lineHeight:'1.4'}}>Click one or multiple to see how your values come together!</p>
      <div style={{display:'flex',flexDirection:'column',gap:'7px'}}>
        {STAKEHOLDER_FILTERS.map(f=>{
          const active=selectedFilters.includes(f.id)
          return(<button key={f.id} onClick={()=>onToggleFilter(f.id)} style={{background:active?P.accent:'#fff',color:active?'#fff':P.textMain,border:`2px solid ${active?P.accent:P.border}`,borderRadius:'8px',padding:'9px 13px',cursor:'pointer',fontWeight:'600',fontSize:'12.5px',textAlign:'left',transition:'all 0.18s',display:'flex',alignItems:'center',gap:'8px'}}>
            <span style={{width:'16px',height:'16px',borderRadius:'4px',background:active?'rgba(255,255,255,0.3)':'rgba(0,0,0,0.06)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'11px',flexShrink:0}}>{active?'✓':''}</span>
            {f.label}
          </button>)
        })}
      </div>
    </div>
  )
}

function RightPanel({selectedFilters,onToggleFilter,hoveredWheel}){
  return(
    <div style={{width:'310px',flexShrink:0,display:'flex',flexDirection:'column'}}>
      <StakeholderFilterMenu selectedFilters={selectedFilters} onToggleFilter={onToggleFilter}/>
      <div style={{marginTop:'30px',minHeight:'340px',flexShrink:0}}>
        <HoverInfoCard wheel={hoveredWheel}/>
      </div>
    </div>
  )
}

/* APP */

export default function App({ embedded = false, youthValues }){
  const [sidebarOpen,setSidebarOpen]=usePersistedState(LS.sidebarOpen,true)
  const [goal,setGoal]=usePersistedState(LS.goal,SHARED_GOAL)
  const [selectedFilters,setSelectedFilters]=usePersistedState(LS.selectedFilters,[])
  const [outlineColorMode,setOutlineColorMode]=usePersistedState(LS.outlineColorMode,false)
  const [textScale,setTextScale]=usePersistedState(LS.textScale,1)
  const [pieceScale,setPieceScale]=usePersistedState(LS.pieceScale,1)
  const [drawings,setDrawings]=usePersistedState(LS.drawings,[])
  const [photos,setPhotos]=usePersistedState(LS.photos,[])
  const [activeFillId,setActiveFillId]=usePersistedState(LS.activeFillId,null)
  const [activeFillType,setActiveFillType]=usePersistedState(LS.activeFillType,null)
  const [goalOpacity,setGoalOpacity]=usePersistedState(LS.goalOpacity,0.6)
  const [editingGoal,setEditingGoal]=useState(false)
  const [hovered,setHovered]=useState(null)
  const [modal,setModal]=useState(null)
  const [resetKey,setResetKey]=useState(0)

  const wheels=useMemo(()=>mergeDuplicateValueWheels(buildWheelLabels(youthValues)),[youthValues])
  const hoveredWheel=wheels.find(w=>w.id===hovered)??null

  const puzzleFillSrc=useMemo(()=>{
    if(activeFillType==='drawing') return drawings.find(d=>d.id===activeFillId)?.dataUrl??null
    if(activeFillType==='photo')   return photos.find(p=>p.id===activeFillId)?.dataUrl??null
    return null
  },[activeFillType,activeFillId,drawings,photos])

  const toggleFilter=useCallback(id=>setSelectedFilters(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]),[setSelectedFilters])

  const addDrawing=useCallback((dataUrl,name)=>{
    const id=Date.now().toString()
    setDrawings(prev=>[{id,dataUrl,name:name?.trim()||`Drawing ${prev.length+1}`,created:new Date().toISOString()},...prev.slice(0,19)])
    return id
  },[setDrawings])

  const deleteDrawing=useCallback(id=>{
    setDrawings(prev=>prev.filter(d=>d.id!==id))
    if(activeFillId===id){setActiveFillId(null);setActiveFillType(null)}
  },[activeFillId,setDrawings,setActiveFillId,setActiveFillType])

  const addPhoto=useCallback((dataUrl,name)=>{
    const id=Date.now().toString()
    setPhotos(prev=>[{id,dataUrl,name:name?.trim()||`Photo ${prev.length+1}`,created:new Date().toISOString()},...prev.slice(0,19)])
    return id
  },[setPhotos])

  const deletePhoto=useCallback(id=>{
    setPhotos(prev=>prev.filter(p=>p.id!==id))
    if(activeFillId===id){setActiveFillId(null);setActiveFillType(null)}
  },[activeFillId,setPhotos,setActiveFillId,setActiveFillType])

  const handleSetAsFill=useCallback((id,type)=>{setActiveFillId(id);setActiveFillType(type);setModal(null)},[setActiveFillId,setActiveFillType])

  const handleReset=useCallback(()=>{
    setSelectedFilters([]);setResetKey(k=>k+1)
  },[setSelectedFilters])

  return(
    <div style={{minHeight:embedded?'720px':'100vh',background:P.bg,position:embedded?'relative':undefined,overflow:embedded?'hidden':undefined}}>
      <Sidebar embedded={embedded} open={sidebarOpen} onToggle={()=>setSidebarOpen(v=>!v)}
        outlineColorMode={outlineColorMode} onOutlineColorModeChange={setOutlineColorMode}
        textScale={textScale} onTextScaleChange={setTextScale}
        pieceScale={pieceScale} onPieceScaleChange={setPieceScale}
        puzzleFillSrc={puzzleFillSrc} activeFillId={activeFillId} activeFillType={activeFillType}
        onClearFill={()=>{setActiveFillId(null);setActiveFillType(null)}}
        goalOpacity={goalOpacity} onGoalOpacityChange={setGoalOpacity}
        onOpenModal={setModal} onReset={handleReset}
      />
      <main style={{marginLeft:sidebarOpen?'268px':'62px',transition:'margin-left 0.3s',minHeight:embedded?'720px':'100vh'}}>
        <RectangularPuzzleView wheels={wheels} goal={goal} onEditGoal={()=>setEditingGoal(true)} hovered={hovered} setHovered={setHovered} hoveredWheel={hoveredWheel} selectedFilters={selectedFilters} onToggleFilter={toggleFilter} puzzleFillSrc={puzzleFillSrc} outlineColorMode={outlineColorMode} textScale={textScale} pieceScale={pieceScale} resetKey={resetKey} goalOpacity={goalOpacity}/>
      </main>

      {/* Modals */}
      {modal==='drawing-library'&&<DrawingLibraryModal drawings={drawings} onClose={()=>setModal(null)} onSetAsFill={id=>handleSetAsFill(id,'drawing')} onDelete={deleteDrawing} onCreateNew={()=>setModal('drawing-canvas')}/>}
      {modal==='drawing-canvas'&&<DrawingCanvasModal onClose={()=>setModal(null)} onSave={(d,n)=>{addDrawing(d,n);setModal(null)}} onSaveAndSetFill={(d,n)=>{const id=addDrawing(d,n);handleSetAsFill(id,'drawing')}}/>}
      {modal==='photo-library'&&<PhotoLibraryModal photos={photos} onClose={()=>setModal(null)} onSetAsFill={id=>handleSetAsFill(id,'photo')} onDelete={deletePhoto} onUploadNew={()=>setModal('photo-upload')}/>}
      {modal==='photo-upload'&&<PhotoUploaderModal onClose={()=>setModal(null)} onSave={(d,n)=>{addPhoto(d,n);setModal(null)}} onSaveAndSetFill={(d,n)=>{const id=addPhoto(d,n);handleSetAsFill(id,'photo')}}/>}
      {editingGoal&&<EditGoalModal goal={goal} onClose={()=>setEditingGoal(false)} onSave={g=>{setGoal(g);setEditingGoal(false)}}/>}
    </div>
  )
}

/* SIDEBAR */

function Sidebar({embedded,open,onToggle,outlineColorMode,onOutlineColorModeChange,textScale,onTextScaleChange,pieceScale,onPieceScaleChange,puzzleFillSrc,activeFillId,activeFillType,onClearFill,goalOpacity,onGoalOpacityChange,onOpenModal,onReset}){
  const [mediaPanelOpen,setMediaPanelOpen]=useState(false)
  const H={fontSize:'13px',fontWeight:'700',textTransform:'uppercase',color:P.accent,marginBottom:'10px',letterSpacing:'0.6px'}
  const SBtn=({onClick,children,color='white',textColor=P.textMain})=>(
    <button onClick={onClick} style={{width:'100%',padding:'10px 13px',background:color,color:textColor,border:`1.5px solid ${P.border}`,borderRadius:'9px',fontWeight:'600',fontSize:'14px',cursor:'pointer',textAlign:'left',marginBottom:'7px',transition:'all 0.15s'}}
      onMouseEnter={e=>e.currentTarget.style.background=P.accentLight} onMouseLeave={e=>e.currentTarget.style.background=color}>
      {children}
    </button>
  )
  return(
    <aside style={{background:P.sidebar,position:embedded?'absolute':'fixed',left:0,top:0,height:embedded?'100%':'100vh',width:open?'268px':'62px',overflowY:'auto',zIndex:1000,borderRight:`1px solid ${P.border}`,transition:'width 0.3s',boxShadow:'2px 0 10px rgba(180,160,220,0.1)'}}>
      <button onClick={onToggle} style={{position:'absolute',right:'-34px',top:'20px',width:'34px',height:'34px',borderRadius:'0 8px 8px 0',background:P.sidebar,border:`1px solid ${P.border}`,borderLeft:'none',cursor:'pointer',fontSize:'14px',color:P.textMid,display:'flex',alignItems:'center',justifyContent:'center'}}>
        {open?'◀':'▶'}
      </button>
      {open&&(
        <div style={{padding:'24px 18px 24px 22px'}}>

          {/* Drawings & Photos */}
          <section style={{marginBottom:'24px',background:'#f5f0fa',borderRadius:'12px',padding:'12px 14px'}}>
            <button type="button" onClick={()=>setMediaPanelOpen(v=>!v)} style={{width:'100%',border:'none',background:'transparent',padding:0,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',textAlign:'left'}}>
              <h3 style={{...H,color:'#7050b0',marginBottom:0}}>✏️ Drawings &amp; Photos</h3>
              <span style={{fontSize:'13px',color:'#7050b0',fontWeight:'700'}}>{mediaPanelOpen?'Hide':'Show'} {mediaPanelOpen?'▴':'▾'}</span>
            </button>
            {mediaPanelOpen&&(
              <div style={{marginTop:'12px'}}>
                <SBtn onClick={()=>onOpenModal('drawing-library')}>📚 Past Drawings</SBtn>
                <SBtn onClick={()=>onOpenModal('drawing-canvas')}>✨ Create New Drawing</SBtn>
                <SBtn onClick={()=>onOpenModal('photo-library')}>📚 Past Photos</SBtn>
                <SBtn onClick={()=>onOpenModal('photo-upload')}>📷 Upload New Photo</SBtn>
              </div>
            )}
          </section>

          {/* Active fill indicator */}
          {puzzleFillSrc&&(
            <section style={{marginBottom:'24px',background:P.accentLight,borderRadius:'10px',padding:'12px 14px'}}>
              <div style={{fontSize:'12px',fontWeight:'700',color:'#6040b0',marginBottom:'8px'}}>🧩 Active Puzzle Fill</div>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <img src={puzzleFillSrc} alt="fill" style={{width:'50px',height:'50px',objectFit:'cover',borderRadius:'8px',border:`2px solid ${P.border}`}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:'12px',color:'#6040b0',marginBottom:'4px'}}>{activeFillType==='drawing'?'Drawing':'Photo'}</div>
                  <button onClick={onClearFill} style={{fontSize:'11px',color:'#c04040',background:'none',border:'none',cursor:'pointer',padding:0,fontWeight:'600'}}>Remove ×</button>
                </div>
              </div>
            </section>
          )}

          {/* Goal piece opacity — only when fill active */}
          {puzzleFillSrc&&(
            <section style={{marginBottom:'24px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'7px'}}>
                <h3 style={{...H,marginBottom:0}}>Goal Piece Opacity</h3>
                <span style={{fontSize:'13px',color:P.textMid,fontWeight:'600'}}>{Math.round(goalOpacity*100)}%</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={goalOpacity} onChange={e=>onGoalOpacityChange(+e.target.value)} style={{width:'100%',accentColor:P.accent}}/>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:'11px',color:P.textLight,marginTop:'3px'}}>
                <span>Transparent</span><span>Opaque</span>
              </div>
            </section>
          )}

          {/* Outline color — only when fill active */}
          {puzzleFillSrc&&(
            <section style={{marginBottom:'24px'}}>
              <h3 style={H}>Outline Color</h3>
              <button onClick={()=>onOutlineColorModeChange(!outlineColorMode)} style={{width:'100%',padding:'9px 13px',borderRadius:'9px',border:`2px solid ${outlineColorMode?P.accent:P.border}`,background:outlineColorMode?P.accentLight:'white',cursor:'pointer',fontWeight:'600',fontSize:'14px',color:outlineColorMode?'#6040b0':P.textMain,textAlign:'left',display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{width:'18px',height:'18px',borderRadius:'50%',background:outlineColorMode?P.accent:P.border,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'12px',color:'white',flexShrink:0}}>{outlineColorMode?'✓':''}</span>
                Color-code by stakeholder
              </button>
              {outlineColorMode&&(
                <div style={{marginTop:'9px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px'}}>
                  {[['Me (Patient)',STKHOLDER_OUTLINE.patient],['Caregiver',STKHOLDER_OUTLINE.caregiver],['Clinician',STKHOLDER_OUTLINE.clinician],['Everyone',STKHOLDER_OUTLINE.everyone],['Mixed',STKHOLDER_OUTLINE.mixed]].map(([l,c])=>(
                    <div key={l} style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'11.5px',color:P.textMain,padding:'2px 0'}}>
                      <div style={{width:'12px',height:'12px',borderRadius:'3px',background:c,flexShrink:0}}/>
                      {l}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Text size slider */}
          <section style={{marginBottom:'24px'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'7px'}}>
              <h3 style={{...H,marginBottom:0}}>Text Size</h3>
              <span style={{fontSize:'13px',color:P.textMid,fontWeight:'600'}}>{Math.round(textScale*100)}%</span>
            </div>
            <input type="range" min="0.7" max="1.5" step="0.05" value={textScale} onChange={e=>onTextScaleChange(+e.target.value)} style={{width:'100%',accentColor:P.accent}}/>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'11px',color:P.textLight,marginTop:'3px'}}>
              <span>Smaller</span><span>Larger</span>
            </div>
          </section>

          {/* Piece size slider */}
          <section style={{marginBottom:'28px'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'7px'}}>
              <h3 style={{...H,marginBottom:0}}>Piece Size</h3>
              <span style={{fontSize:'13px',color:P.textMid,fontWeight:'600'}}>{Math.round(pieceScale*100)}%</span>
            </div>
            <input type="range" min="0.65" max="1.3" step="0.05" value={pieceScale} onChange={e=>onPieceScaleChange(+e.target.value)} style={{width:'100%',accentColor:P.accent}}/>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:'11px',color:P.textLight,marginTop:'3px'}}>
              <span>Smaller</span><span>Larger</span>
            </div>
          </section>

          {/* Reset */}
          <button onClick={onReset} style={{width:'100%',padding:'11px',borderRadius:'10px',border:`2px solid #e0c8c8`,background:'#fff5f5',color:'#a04040',cursor:'pointer',fontWeight:'700',fontSize:'14px',transition:'all 0.18s'}}
            onMouseEnter={e=>e.currentTarget.style.background='#fce8e8'} onMouseLeave={e=>e.currentTarget.style.background='#fff5f5'}>
            🔄 Reset All Views & Pieces
          </button>
        </div>
      )}
    </aside>
  )
}

/* DRAWING LIBRARY MODAL */

function DrawingLibraryModal({drawings,onClose,onSetAsFill,onDelete,onCreateNew}){
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(60,40,80,0.5)',zIndex:5000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div style={{background:'white',borderRadius:'18px',width:'min(95vw,820px)',maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 24px 80px rgba(0,0,0,0.3)'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'18px 24px',borderBottom:`1px solid ${P.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:P.accentLight,borderRadius:'18px 18px 0 0'}}>
          <div style={{fontSize:'20px',fontWeight:'700',color:P.textMain}}>📚 Past Drawings</div>
          <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
            <button onClick={onCreateNew} style={{padding:'8px 16px',borderRadius:'8px',border:'none',background:P.accent,color:'white',cursor:'pointer',fontWeight:'700',fontSize:'13px'}}>✨ Create New</button>
            <button onClick={onClose} style={{border:'none',background:'none',cursor:'pointer',fontSize:'24px',color:P.textMid,lineHeight:1}}>×</button>
          </div>
        </div>
        <div style={{padding:'20px',overflowY:'auto',flex:1}}>
          {drawings.length===0?(
            <div style={{textAlign:'center',padding:'60px',color:P.textMid}}>
              <div style={{fontSize:'48px',marginBottom:'14px'}}>✏️</div>
              <div style={{fontSize:'16px',fontWeight:'600',marginBottom:'8px'}}>No drawings yet</div>
              <div style={{fontSize:'14px'}}>Create your first drawing to get started!</div>
              <button onClick={onCreateNew} style={{marginTop:'20px',padding:'11px 24px',borderRadius:'10px',border:'none',background:P.accent,color:'white',cursor:'pointer',fontWeight:'700',fontSize:'14px'}}>✨ Create New Drawing</button>
            </div>
          ):(
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:'16px'}}>
              {drawings.map(d=>(
                <div key={d.id} style={{borderRadius:'12px',overflow:'hidden',border:`2px solid ${P.border}`,background:'white',boxShadow:'0 2px 8px rgba(0,0,0,0.07)'}}>
                  <img src={d.dataUrl} alt={d.name} style={{width:'100%',height:'130px',objectFit:'cover',display:'block'}}/>
                  <div style={{padding:'10px 12px'}}>
                    <div style={{fontSize:'13px',fontWeight:'600',color:P.textMain,marginBottom:'8px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.name||'Untitled'}</div>
                    <div style={{display:'flex',gap:'6px'}}>
                      <button onClick={()=>{onSetAsFill(d.id);onClose()}} style={{flex:1,padding:'7px',borderRadius:'7px',border:'none',background:P.accentLight,color:'#6040b0',cursor:'pointer',fontWeight:'700',fontSize:'12px'}}>Set as Fill</button>
                      <button onClick={()=>onDelete(d.id)} style={{padding:'7px 10px',borderRadius:'7px',border:'none',background:'#fce4ec',color:'#c0392b',cursor:'pointer',fontSize:'16px'}}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* DRAWING CANVAS MODAL */

const EMOJI_PALETTE=['😊','😍','💪','🎉','🌟','✨','❤️','💚','🏥','💊','🌿','🍎','🏠','✈️','🌴','⭐','🏆','📚','👨‍👩‍👧','🤝','🙏','🫂','🐾','🌸','🌈','☀️','🦋','🌊','🌻','⚽','🎸','🎨','🏊','🎵','🎭','🎓']
const DRAW_COLORS=['#2d2a35','#d04468','#c06828','#c0a020','#2868c0','#2d6a3a','#8060c0','#60a0c0','#c08050','#ffffff']
const CANVAS_W=620,CANVAS_H=400

function DrawingCanvasModal({onClose,onSave,onSaveAndSetFill}){
  const canvasRef=useRef(null)
  const drawingRef=useRef(false)
  const lastPtRef=useRef(null)
  const emojiDragRef=useRef(null)
  const [tool,setTool]=useState('pen')
  const [color,setColor]=useState('#2d2a35')
  const [brushSize,setBrushSize]=useState(6)
  const [mode,setMode]=useState('draw')
  const [emojiEls,setEmojiEls]=useState([])
  const [selEmojiId,setSelEmojiId]=useState(null)
  const [drawingName,setDrawingName]=useState('')

  useEffect(()=>{
    const ctx=canvasRef.current.getContext('2d')
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,CANVAS_W,CANVAS_H)
  },[])

  useEffect(()=>{
    const move=e=>{
      if(!emojiDragRef.current) return
      const{id,sMX,sMY,sX,sY}=emojiDragRef.current
      const x=Math.max(0,Math.min(CANVAS_W,sX+e.clientX-sMX))
      const y=Math.max(0,Math.min(CANVAS_H,sY+e.clientY-sMY))
      setEmojiEls(prev=>prev.map(el=>el.id===id?{...el,x,y}:el))
    }
    const up=()=>{emojiDragRef.current=null}
    window.addEventListener('mousemove',move);window.addEventListener('mouseup',up)
    return()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)}
  },[])

  const getXY=e=>{
    const rect=canvasRef.current.getBoundingClientRect()
    return[(e.clientX-rect.left)*(CANVAS_W/rect.width),(e.clientY-rect.top)*(CANVAS_H/rect.height)]
  }

  const startDraw=e=>{
    if(mode!=='draw') return
    const[x,y]=getXY(e)
    const ctx=canvasRef.current.getContext('2d')
    ctx.globalCompositeOperation='source-over'
    ctx.strokeStyle=tool==='eraser'?'#ffffff':color
    ctx.lineWidth=tool==='eraser'?brushSize*4:brushSize
    ctx.lineCap='round';ctx.lineJoin='round'
    ctx.beginPath();ctx.moveTo(x,y)
    lastPtRef.current=[x,y];drawingRef.current=true
  }

  const draw=e=>{
    if(!drawingRef.current||!lastPtRef.current) return
    const[x,y]=getXY(e)
    const[lx,ly]=lastPtRef.current
    const ctx=canvasRef.current.getContext('2d')
    ctx.quadraticCurveTo(lx,ly,(x+lx)/2,(y+ly)/2)
    ctx.stroke();ctx.beginPath();ctx.moveTo((x+lx)/2,(y+ly)/2)
    lastPtRef.current=[x,y]
  }

  const stopDraw=()=>{drawingRef.current=false;lastPtRef.current=null}

  const clearCanvas=()=>{
    const ctx=canvasRef.current.getContext('2d')
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,CANVAS_W,CANVAS_H)
    setEmojiEls([]);setSelEmojiId(null)
  }

  const addEmoji=emoji=>{
    const id=Date.now()
    setEmojiEls(prev=>[...prev,{id,emoji,x:CANVAS_W/2,y:CANVAS_H/2,size:52}])
    setSelEmojiId(id);setMode('move')
  }

  const handleEmojiDown=(e,id)=>{
    e.preventDefault();e.stopPropagation();setSelEmojiId(id)
    const el=emojiEls.find(el=>el.id===id);if(!el) return
    emojiDragRef.current={id,sMX:e.clientX,sMY:e.clientY,sX:el.x,sY:el.y}
  }

  const changeSize=(id,delta)=>setEmojiEls(prev=>prev.map(el=>el.id===id?{...el,size:Math.max(16,Math.min(120,el.size+delta))}:el))
  const delEmoji=id=>{setEmojiEls(prev=>prev.filter(el=>el.id!==id));setSelEmojiId(null)}

  const exportImg=()=>{
    const oc=document.createElement('canvas');oc.width=CANVAS_W;oc.height=CANVAS_H
    const ctx=oc.getContext('2d')
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,CANVAS_W,CANVAS_H)
    ctx.drawImage(canvasRef.current,0,0)
    emojiEls.forEach(el=>{
      ctx.font=`${el.size}px Arial, sans-serif`
      ctx.textAlign='center';ctx.textBaseline='middle'
      ctx.fillText(el.emoji,el.x,el.y)
    })
    return oc.toDataURL('image/jpeg',0.88)
  }

  const selEmoji=emojiEls.find(el=>el.id===selEmojiId)
  const btnStyle=(active)=>({padding:'7px 6px',borderRadius:'7px',border:`2px solid ${active?P.accent:P.border}`,background:active?P.accentLight:'white',fontSize:'13px',fontWeight:'600',cursor:'pointer',color:active?'#6040b0':P.textMain,transition:'all 0.15s',flex:1})

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(60,40,80,0.6)',zIndex:5000,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'white',borderRadius:'18px',overflow:'hidden',width:'min(98vw,1060px)',maxHeight:'95vh',display:'flex',flexDirection:'column',boxShadow:'0 24px 80px rgba(0,0,0,0.4)'}}>
        <div style={{padding:'16px 22px',borderBottom:`1px solid ${P.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:P.accentLight,borderRadius:'18px 18px 0 0'}}>
          <div>
            <div style={{fontSize:'18px',fontWeight:'700',color:P.textMain}}>✏️ Create New Drawing</div>
            <div style={{fontSize:'13px',color:P.textMid,marginTop:'2px'}}>Draw a picture of what you want your future to look like:</div>
          </div>
          <button onClick={onClose} style={{border:'none',background:'none',cursor:'pointer',fontSize:'24px',color:P.textMid,lineHeight:1}}>×</button>
        </div>
        <div style={{display:'flex',flex:1,overflow:'hidden',minHeight:0}}>
          {/* Left tools */}
          <div style={{width:'155px',flexShrink:0,padding:'14px',borderRight:`1px solid ${P.border}`,display:'flex',flexDirection:'column',gap:'13px',overflowY:'auto',background:'#fafafa'}}>
            <div>
              <div style={{fontSize:'10px',fontWeight:'700',color:P.textMid,textTransform:'uppercase',marginBottom:'6px'}}>Mode</div>
              <div style={{display:'flex',gap:'5px'}}>
                <button onClick={()=>setMode('draw')} style={btnStyle(mode==='draw')}>🖊 Draw</button>
                <button onClick={()=>setMode('move')} style={btnStyle(mode==='move')}>✋ Move</button>
              </div>
            </div>
            {mode==='draw'&&<>
              <div>
                <div style={{fontSize:'10px',fontWeight:'700',color:P.textMid,textTransform:'uppercase',marginBottom:'6px'}}>Tool</div>
                <div style={{display:'flex',gap:'5px'}}>
                  <button onClick={()=>setTool('pen')} style={btnStyle(tool==='pen')} title="Pen">🖊 Pen</button>
                  <button onClick={()=>setTool('eraser')} style={btnStyle(tool==='eraser')} title="Eraser">⬜</button>
                </div>
              </div>
              {tool==='pen'&&<div>
                <div style={{fontSize:'10px',fontWeight:'700',color:P.textMid,textTransform:'uppercase',marginBottom:'6px'}}>Color</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'4px',marginBottom:'6px'}}>
                  {DRAW_COLORS.map(c=><button key={c} onClick={()=>setColor(c)} style={{aspectRatio:'1',background:c,border:color===c?`3px solid ${P.accent}`:`1.5px solid ${P.border}`,borderRadius:'6px',cursor:'pointer'}}/>)}
                </div>
                <input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{width:'100%',height:'28px',border:`1.5px solid ${P.border}`,borderRadius:'6px',cursor:'pointer',padding:'2px'}}/>
              </div>}
              <div>
                <div style={{fontSize:'10px',fontWeight:'700',color:P.textMid,textTransform:'uppercase',marginBottom:'6px'}}>{tool==='eraser'?'Eraser':'Brush'}: {tool==='eraser'?brushSize*4:brushSize}px</div>
                <input type="range" min="2" max="28" value={brushSize} onChange={e=>setBrushSize(+e.target.value)} style={{width:'100%',accentColor:P.accent}}/>
              </div>
            </>}
            {mode==='move'&&selEmoji&&(
              <div style={{background:P.accentLight,borderRadius:'10px',padding:'10px',textAlign:'center'}}>
                <div style={{fontSize:'10px',fontWeight:'700',color:P.textMid,textTransform:'uppercase',marginBottom:'7px'}}>Selected</div>
                <div style={{fontSize:'36px',marginBottom:'6px'}}>{selEmoji.emoji}</div>
                <div style={{fontSize:'11px',color:P.textMid,marginBottom:'7px'}}>Size: {selEmoji.size}px</div>
                <div style={{display:'flex',gap:'4px',marginBottom:'7px'}}>
                  <button onClick={()=>changeSize(selEmojiId,-8)} style={{flex:1,padding:'5px',borderRadius:'6px',border:`1px solid ${P.border}`,cursor:'pointer',fontWeight:'700',fontSize:'18px'}}>−</button>
                  <button onClick={()=>changeSize(selEmojiId,8)} style={{flex:1,padding:'5px',borderRadius:'6px',border:`1px solid ${P.border}`,cursor:'pointer',fontWeight:'700',fontSize:'18px'}}>+</button>
                </div>
                <button onClick={()=>delEmoji(selEmojiId)} style={{width:'100%',padding:'6px',borderRadius:'7px',border:'none',background:'#fce4ec',color:'#c0392b',cursor:'pointer',fontWeight:'600',fontSize:'12px'}}>🗑 Delete</button>
              </div>
            )}
            {mode==='move'&&!selEmoji&&<div style={{fontSize:'12px',color:P.textMid,textAlign:'center',padding:'10px',background:'#f8f5ff',borderRadius:'8px'}}>Click an emoji on the canvas to select & move it</div>}
          </div>
          {/* Canvas */}
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'#e8e8e8',padding:'14px'}}>
            <div style={{position:'relative',boxShadow:'0 4px 20px rgba(0,0,0,0.22)',borderRadius:'3px',overflow:'visible'}}>
              <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                style={{display:'block',cursor:tool==='eraser'?'cell':'crosshair',pointerEvents:mode==='draw'?'auto':'none'}}
              />
              <div style={{position:'absolute',inset:0,pointerEvents:mode==='move'?'auto':'none'}}
                onClick={e=>{if(e.target===e.currentTarget)setSelEmojiId(null)}}>
                {emojiEls.map(el=>(
                  <div key={el.id} onMouseDown={e=>handleEmojiDown(e,el.id)}
                    style={{position:'absolute',left:el.x-el.size*.5,top:el.y-el.size*.5,width:el.size,height:el.size,fontSize:el.size*.85,lineHeight:'1',display:'flex',alignItems:'center',justifyContent:'center',cursor:'grab',userSelect:'none',outline:selEmojiId===el.id?'2.5px dashed #b094d8':'none',borderRadius:'5px'}}>
                    {el.emoji}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Right: emoji palette */}
          <div style={{width:'148px',flexShrink:0,padding:'14px',borderLeft:`1px solid ${P.border}`,overflowY:'auto',background:'#fafafa'}}>
            <div style={{fontSize:'10px',fontWeight:'700',color:P.textMid,textTransform:'uppercase',marginBottom:'10px'}}>Add Emoji</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'5px'}}>
              {EMOJI_PALETTE.map(emoji=>(
                <button key={emoji} onClick={()=>addEmoji(emoji)} style={{fontSize:'22px',padding:'6px 3px',borderRadius:'8px',border:`1.5px solid ${P.border}`,cursor:'pointer',background:'white',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background=P.accentLight} onMouseLeave={e=>e.currentTarget.style.background='white'}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{padding:'13px 22px',borderTop:`1px solid ${P.border}`,display:'flex',alignItems:'center',gap:'10px',background:'#f8f8f8',borderRadius:'0 0 18px 18px'}}>
          <input value={drawingName} onChange={e=>setDrawingName(e.target.value)} placeholder="Name this drawing (optional)"
            style={{flex:1,padding:'9px 12px',borderRadius:'8px',border:`1.5px solid ${P.border}`,fontSize:'13px',outline:'none'}}/>
          <button onClick={clearCanvas} style={{padding:'9px 16px',borderRadius:'8px',border:`1.5px solid ${P.border}`,background:'white',cursor:'pointer',fontWeight:'600',fontSize:'13px',color:P.textMain,flexShrink:0}}>Start Over</button>
          <button onClick={()=>onSave(exportImg(),drawingName)} style={{padding:'9px 18px',borderRadius:'8px',border:'none',background:P.green,color:P.greenText,cursor:'pointer',fontWeight:'700',fontSize:'13px',flexShrink:0}}>Save to Collection</button>
          <button onClick={()=>onSaveAndSetFill(exportImg(),drawingName)} style={{padding:'9px 18px',borderRadius:'8px',border:'none',background:P.accent,color:'white',cursor:'pointer',fontWeight:'700',fontSize:'13px',flexShrink:0}}>Save + Set as Fill</button>
        </div>
      </div>
    </div>
  )
}

/* PHOTO LIBRARY MODAL */

function PhotoLibraryModal({photos,onClose,onSetAsFill,onDelete,onUploadNew}){
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(60,40,80,0.5)',zIndex:5000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div style={{background:'white',borderRadius:'18px',width:'min(95vw,820px)',maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 24px 80px rgba(0,0,0,0.3)'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'18px 24px',borderBottom:`1px solid ${P.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:'#edf5ff',borderRadius:'18px 18px 0 0'}}>
          <div style={{fontSize:'20px',fontWeight:'700',color:P.textMain}}>📚 Past Photos</div>
          <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
            <button onClick={onUploadNew} style={{padding:'8px 16px',borderRadius:'8px',border:'none',background:'#3070c0',color:'white',cursor:'pointer',fontWeight:'700',fontSize:'13px'}}>📷 Upload New</button>
            <button onClick={onClose} style={{border:'none',background:'none',cursor:'pointer',fontSize:'24px',color:P.textMid,lineHeight:1}}>×</button>
          </div>
        </div>
        <div style={{padding:'20px',overflowY:'auto',flex:1}}>
          {photos.length===0?(
            <div style={{textAlign:'center',padding:'60px',color:P.textMid}}>
              <div style={{fontSize:'48px',marginBottom:'14px'}}>🖼️</div>
              <div style={{fontSize:'16px',fontWeight:'600',marginBottom:'8px'}}>No photos yet</div>
              <div style={{fontSize:'14px'}}>Upload your first photo to get started!</div>
              <button onClick={onUploadNew} style={{marginTop:'20px',padding:'11px 24px',borderRadius:'10px',border:'none',background:'#3070c0',color:'white',cursor:'pointer',fontWeight:'700',fontSize:'14px'}}>📷 Upload New Photo</button>
            </div>
          ):(
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:'16px'}}>
              {photos.map(p=>(
                <div key={p.id} style={{borderRadius:'12px',overflow:'hidden',border:`2px solid ${P.border}`,background:'white',boxShadow:'0 2px 8px rgba(0,0,0,0.07)'}}>
                  <img src={p.dataUrl} alt={p.name} style={{width:'100%',height:'130px',objectFit:'cover',display:'block'}}/>
                  <div style={{padding:'10px 12px'}}>
                    <div style={{fontSize:'13px',fontWeight:'600',color:P.textMain,marginBottom:'8px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name||'Untitled'}</div>
                    <div style={{display:'flex',gap:'6px'}}>
                      <button onClick={()=>{onSetAsFill(p.id);onClose()}} style={{flex:1,padding:'7px',borderRadius:'7px',border:'none',background:'#edf5ff',color:'#3070c0',cursor:'pointer',fontWeight:'700',fontSize:'12px'}}>Set as Fill</button>
                      <button onClick={()=>onDelete(p.id)} style={{padding:'7px 10px',borderRadius:'7px',border:'none',background:'#fce4ec',color:'#c0392b',cursor:'pointer',fontSize:'16px'}}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* PHOTO UPLOADER MODAL */

function PhotoUploaderModal({onClose,onSave,onSaveAndSetFill}){
  const [preview,setPreview]=useState(null)
  const [photoName,setPhotoName]=useState('')
  const fileRef=useRef(null)
  const handleFile=e=>{
    const file=e.target.files?.[0]
    if(file){const r=new FileReader();r.onload=ev=>setPreview(ev.target?.result);r.readAsDataURL(file)}
  }
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(60,40,80,0.5)',zIndex:5000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={onClose}>
      <div style={{background:'white',borderRadius:'18px',width:'min(95vw,540px)',boxShadow:'0 24px 80px rgba(0,0,0,0.3)'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'18px 24px',borderBottom:`1px solid ${P.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',background:'#edf5ff',borderRadius:'18px 18px 0 0'}}>
          <div>
            <div style={{fontSize:'18px',fontWeight:'700',color:P.textMain}}>📷 Upload New Photo</div>
            <div style={{fontSize:'13px',color:P.textMid,marginTop:'2px'}}>Upload a photo of what you want your future to look like:</div>
          </div>
          <button onClick={onClose} style={{border:'none',background:'none',cursor:'pointer',fontSize:'24px',color:P.textMid,lineHeight:1}}>×</button>
        </div>
        <div style={{padding:'24px'}}>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:'none'}}/>
          {!preview?(
            <div onClick={()=>fileRef.current?.click()} style={{border:`3px dashed ${P.border}`,borderRadius:'14px',padding:'56px',textAlign:'center',cursor:'pointer',background:'#f8faff',transition:'all 0.2s'}}
              onMouseEnter={e=>e.currentTarget.style.background='#edf5ff'} onMouseLeave={e=>e.currentTarget.style.background='#f8faff'}>
              <div style={{fontSize:'44px',marginBottom:'12px'}}>📷</div>
              <div style={{fontSize:'16px',fontWeight:'700',color:P.textMain,marginBottom:'6px'}}>Click to upload a photo</div>
              <div style={{fontSize:'13px',color:P.textLight}}>JPG, PNG, GIF supported</div>
            </div>
          ):(
            <div style={{textAlign:'center'}}>
              <img src={preview} alt="preview" style={{maxWidth:'100%',maxHeight:'270px',borderRadius:'12px',objectFit:'contain',border:`2px solid ${P.border}`}}/>
              <button onClick={()=>{setPreview(null);if(fileRef.current)fileRef.current.value=''}} style={{display:'block',margin:'10px auto 0',padding:'6px 14px',borderRadius:'7px',border:`1px solid ${P.border}`,background:'white',cursor:'pointer',fontSize:'12px',color:P.textMid}}>Choose different photo</button>
            </div>
          )}
          <input value={photoName} onChange={e=>setPhotoName(e.target.value)} placeholder="Name this photo (optional)"
            style={{width:'100%',marginTop:'16px',padding:'10px 13px',borderRadius:'9px',border:`1.5px solid ${P.border}`,fontSize:'13px',outline:'none'}}/>
        </div>
        <div style={{padding:'14px 24px',borderTop:`1px solid ${P.border}`,display:'flex',gap:'10px',justifyContent:'flex-end',background:'#f8f8f8',borderRadius:'0 0 18px 18px'}}>
          <button onClick={onClose} style={{padding:'9px 18px',borderRadius:'8px',border:`1.5px solid ${P.border}`,background:'white',cursor:'pointer',fontWeight:'600',fontSize:'13px'}}>Cancel</button>
          {preview&&<>
            <button onClick={()=>onSave(preview,photoName)} style={{padding:'9px 18px',borderRadius:'8px',border:'none',background:P.green,color:P.greenText,cursor:'pointer',fontWeight:'700',fontSize:'13px'}}>Save to Collection</button>
            <button onClick={()=>onSaveAndSetFill(preview,photoName)} style={{padding:'9px 18px',borderRadius:'8px',border:'none',background:'#3070c0',color:'white',cursor:'pointer',fontWeight:'700',fontSize:'13px'}}>Save + Set as Fill</button>
          </>}
        </div>
      </div>
    </div>
  )
}

/* RECTANGULAR PUZZLE VIEW  (mosaic fill via clipPath) */

function RectangularPuzzleView({wheels,goal,onEditGoal,hovered,setHovered,hoveredWheel,selectedFilters,onToggleFilter,puzzleFillSrc,outlineColorMode,textScale,pieceScale,resetKey,goalOpacity}){
  const PS=Math.max(85,Math.min(200,Math.round(150*pieceScale)))
  const displayWheels=useMemo(()=>mergeDuplicateValueWheels(wheels),[wheels])
  const layout=useMemo(()=>getPuzzleLayout(displayWheels.length),[displayWheels.length])
  const positionedWheels=useMemo(()=>getSemanticLayoutItems(displayWheels,layout),[displayWheels,layout])
  const positionById=useMemo(()=>new Map(positionedWheels.map(item=>[item.w.id,item])),[positionedWheels])
  const TOTAL=PS*layout.gridSize
  const [rectOffsets,setRectOffsets]=useState({})
  const dragRef=useRef({id:null,sx:0,sy:0})
  const [draggingId,setDraggingId]=useState(null)
  useEffect(()=>{setRectOffsets({})},[resetKey])
  const startDrag=useCallback((e,id)=>{e.preventDefault();const off=rectOffsets[id]||{x:0,y:0};dragRef.current={id,sx:e.clientX-off.x,sy:e.clientY-off.y};setDraggingId(id)},[rectOffsets])
  useEffect(()=>{
    if(!draggingId) return
    const move=e=>setRectOffsets(prev=>({...prev,[dragRef.current.id]:{x:e.clientX-dragRef.current.sx,y:e.clientY-dragRef.current.sy}}))
    const up=()=>{dragRef.current={id:null,sx:0,sy:0};setDraggingId(null)}
    window.addEventListener('mousemove',move);window.addEventListener('mouseup',up)
    return()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)}
  },[draggingId])
  const orderedWheels=useMemo(()=>{
    if(!draggingId) return displayWheels.map((w,idx)=>({w,idx}))
    const rest=displayWheels.map((w,idx)=>({w,idx})).filter(({w})=>w.id!==draggingId)
    const drag=displayWheels.map((w,idx)=>({w,idx})).find(({w})=>w.id===draggingId)
    return drag?[...rest,drag]:displayWheels.map((w,idx)=>({w,idx}))
  },[displayWheels,draggingId])
  const ts=textScale,tF='drop-shadow(0px 0px 3px white)'
  const goalFill=puzzleFillSrc?`rgba(255,255,255,${goalOpacity??0.6})`:'white'
  return(
    <div style={{padding:'28px 32px',minHeight:'100vh'}}>
      <h1 style={{fontSize:'28px',fontWeight:'700',marginBottom:'28px',color:P.textMain,textAlign:'center'}}>What is important to us?</h1>
      <div style={{display:'flex',gap:'28px',alignItems:'flex-start',flexWrap:'wrap'}}>
        <div style={{position:'relative',width:TOTAL,height:TOTAL,flexShrink:0}}>
          <svg viewBox={`${-PS*.18} ${-PS*.18} ${TOTAL+PS*.36} ${TOTAL+PS*.36}`} width={TOTAL+PS*.36} height={TOTAL+PS*.36}
            style={{position:'absolute',top:`-${PS*.18}px`,left:`-${PS*.18}px`,overflow:'visible'}}>
            <defs>
              {positionedWheels.map(({w,pos})=>{
                const color=getPositionColor(pos,layout.gridSize)
                return <radialGradient key={`rg-${w.id}`} id={`rg-${w.id}`} cx="50%" cy="44%" r="82%"><stop offset="0%" stopColor="#FFFFFF"/><stop offset="28%" stopColor={lightenHex(color,0.45)}/><stop offset="100%" stopColor={color}/></radialGradient>
              })}
              {puzzleFillSrc&&positionedWheels.map(({w,pos})=>{
                if(!pos) return null
                const{tE,rE,bE,lE}=getRectEdges(pos.r,pos.c,layout.validSet,layout.gridSize)
                return<clipPath key={`cp-${w.id}`} id={`cp-${w.id}`}><path d={jigsawPath(PS,tE,rE,bE,lE)}/></clipPath>
              })}
              <filter id="rshadow"><feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.09"/></filter>
              <filter id="rlift"><feDropShadow dx="0" dy="10" stdDeviation="14" floodOpacity="0.20"/></filter>
            </defs>
            {orderedWheels.map(({w})=>{
              const placed=positionById.get(w.id),pos=placed?.pos;if(!pos) return null
              const{r,c}=pos,{tE,rE,bE,lE}=getRectEdges(r,c,layout.validSet,layout.gridSize),pPath=jigsawPath(PS,tE,rE,bE,lE)
              const off=rectOffsets[w.id]||{x:0,y:0},x=c*PS+off.x,y=r*PS+off.y
              const isDrag=draggingId===w.id,isHover=hovered===w.id,matches=pieceMatchesFilters(w,selectedFilters)
              const strokeClr=(outlineColorMode&&puzzleFillSrc)?getStakeholderOutline(w.stakeholder):'rgba(255,255,255,0.88)'
              const lw=w.shortLabel.split(' '),lh=Math.ceil(lw.length/2)
              return(
                <g key={w.id} transform={`translate(${x},${y})`} filter={isDrag?'url(#rlift)':'url(#rshadow)'}
                  onMouseDown={e=>startDrag(e,w.id)} onMouseEnter={()=>setHovered(w.id)} onMouseLeave={()=>setHovered(null)}
                  style={{cursor:isDrag?'grabbing':'grab',opacity:matches?1:(selectedFilters.length?0.28:1),transition:isDrag?'none':'opacity 0.25s'}}>
                  {puzzleFillSrc?(
                    <>
                      <image href={puzzleFillSrc} x={-c*PS} y={-r*PS} width={TOTAL} height={TOTAL} preserveAspectRatio="xMidYMid slice" clipPath={`url(#cp-${w.id})`} style={{filter:isHover?'brightness(1.06)':'none',transition:'filter 0.18s'}}/>
                      <path d={pPath} fill="none" stroke={strokeClr} strokeWidth={isHover||isDrag?'3':'2'}/>
                    </>
                  ):(
                    <path d={pPath} fill={`url(#rg-${w.id})`} stroke="rgba(255,255,255,0.88)" strokeWidth={isHover||isDrag?'2.5':'1.8'} style={{filter:isHover?'brightness(1.07)':'none',transition:'filter 0.18s'}}/>
                  )}
                  {puzzleFillSrc&&<>
                    <rect x={PS/2-PS*0.40} y={PS/2-27*ts} width={PS*0.80} height={lw.length>lh?30*ts:18*ts} rx={5} fill="rgba(255,255,255,0.82)" style={{pointerEvents:'none'}}/>
                    <rect x={PS/2-PS*0.36} y={PS/2+5*ts} width={PS*0.72} height={14*ts} rx={5} fill="rgba(255,255,255,0.82)" style={{pointerEvents:'none'}}/>
                  </>}
                  <text x={PS/2} y={PS/2-18*ts} textAnchor="middle" dominantBaseline="middle" fontSize={11*ts} fontWeight="700" fill={P.textMain} style={{pointerEvents:'none',userSelect:'none',filter:puzzleFillSrc?'none':tF}}>{lw.slice(0,lh).join(' ')}</text>
                  {lw.length>lh&&<text x={PS/2} y={PS/2-4*ts} textAnchor="middle" dominantBaseline="middle" fontSize={11*ts} fontWeight="700" fill={P.textMain} style={{pointerEvents:'none',userSelect:'none',filter:puzzleFillSrc?'none':tF}}>{lw.slice(lh).join(' ')}</text>}
                  <text x={PS/2} y={PS/2+12*ts} textAnchor="middle" dominantBaseline="middle" fontSize={8.5*ts} fontWeight="600" fill={P.textMid} style={{pointerEvents:'none',userSelect:'none',filter:puzzleFillSrc?'none':tF}}>
                    {shortStakeholder(w.stakeholder).length>20?shortStakeholder(w.stakeholder).substring(0,18)+'…':shortStakeholder(w.stakeholder)}
                  </text>
                </g>
              )
            })}
          </svg>
          {(()=>{const th=PS*.15,tw=PS*.30,gbPath=puzzleBoxPath(PS*layout.goalRect.size,PS*layout.goalRect.size,th,tw),goalLeft=layout.goalRect.c*PS,goalTop=layout.goalRect.r*PS;return(<>
            <svg viewBox={`${-th-4} ${-th-4} ${PS*2+2*(th+4)} ${PS*2+2*(th+4)}`} width={PS*2+2*(th+4)} height={PS*2+2*(th+4)}
              style={{position:'absolute',left:goalLeft-(th+4),top:goalTop-(th+4),overflow:'visible',pointerEvents:'none',zIndex:499}}>
              <defs>
                <filter id="rgshadow"><feDropShadow dx="0" dy="5" stdDeviation="10" floodOpacity="0.14"/></filter>
                {puzzleFillSrc&&<clipPath id="goalboxcp"><path d={gbPath}/></clipPath>}
              </defs>
              {puzzleFillSrc&&<image href={puzzleFillSrc} x={-goalLeft} y={-goalTop} width={TOTAL} height={TOTAL} preserveAspectRatio="xMidYMid slice" clipPath="url(#goalboxcp)"/>}
              <path d={gbPath} fill={goalFill} stroke={P.goalBorder} strokeWidth="2.5" filter="url(#rgshadow)" style={{transition:'fill 0.25s'}}/>
            </svg>
            <button onClick={onEditGoal} style={{position:'absolute',left:goalLeft,top:goalTop,width:PS*layout.goalRect.size,height:PS*layout.goalRect.size,background:'transparent',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',padding:'16px',textAlign:'center',zIndex:500}}>
              <div style={{fontSize:`${12*ts}px`,color:P.textMid,marginBottom:'8px',textTransform:'uppercase',fontWeight:'700'}}>Our Shared Goal:</div>
              <div style={{color:P.textMain,lineHeight:'1.45',fontSize:`${15*ts}px`,fontWeight:'600'}}>{goal}</div>
            </button>
          </>)})()}
        </div>
        <div style={{paddingTop:'48px',flexShrink:0}}>
          <RightPanel selectedFilters={selectedFilters} onToggleFilter={onToggleFilter} hoveredWheel={hoveredWheel}/>
        </div>
      </div>
    </div>
  )
}

/* EDIT GOAL MODAL */

function EditGoalModal({goal,onClose,onSave}){
  const[text,setText]=useState(goal)
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(60,40,80,0.35)',display:'flex',justifyContent:'center',alignItems:'center',zIndex:10000}} onClick={onClose}>
      <div style={{background:'white',padding:'30px',borderRadius:'18px',width:'calc(100% - 60px)',maxWidth:'460px',boxShadow:'0 20px 60px rgba(120,80,180,0.2)'}} onClick={e=>e.stopPropagation()}>
        <h2 style={{fontSize:'20px',fontWeight:'700',marginBottom:'16px',color:P.textMain}}>Our Shared Goal</h2>
        <textarea rows={4} value={text} onChange={e=>setText(e.target.value)} autoFocus
          style={{width:'100%',padding:'11px',fontSize:'14px',fontFamily:'inherit',borderRadius:'9px',border:`2px solid ${P.border}`,marginBottom:'16px',resize:'vertical',outline:'none',color:P.textMain}}/>
        <div style={{display:'flex',gap:'10px',justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'10px 20px',borderRadius:'8px',border:`2px solid ${P.border}`,background:'white',cursor:'pointer',fontWeight:'600',color:P.textMain,fontSize:'13px'}}>Cancel</button>
          <button onClick={()=>onSave(text)} style={{padding:'10px 20px',borderRadius:'8px',border:'none',background:P.green,color:P.greenText,cursor:'pointer',fontWeight:'700',fontSize:'13px'}}>Save</button>
        </div>
      </div>
    </div>
  )
}
