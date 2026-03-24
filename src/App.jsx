import { useState, useMemo, useRef, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";
import EmailModule from "./EmailModule.jsx";
import GEDModule, { DOC_CATEGORIES } from "./GEDModule.jsx";
import ChatBubble, { openChatForDossier } from "./ChatModule.jsx";
import { lookupUrbanisme, updateUserSmtp, login as apiLogin, logout as apiLogout, getToken } from "./api.js";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const LOGO_SRC = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCABaAH0DASIAAhEBAxEB/8QAHAABAQEAAwEBAQAAAAAAAAAAAAcIAwUGBAEJ/8QANxAAAQMDAgQEBAQFBQEAAAAAAQIDBAAFEQYHEiExQQgTUXEUIjJhFUJSgSRygpGhFhcjM2Lh/8QAGwEBAAEFAQAAAAAAAAAAAAAAAAYBAwQFBwL/xAA1EQABAwIEBQEFBwUBAAAAAAABAgMRAAQFBiExEkFRYXGBBxUiMqETFEJSkZLBIyRiovCx/9oADAMBAAIRAxEAPwD+ntKUpSlKUpSlKUpSlKUpSlKUpSlKUpSlKUpSlKUpSlKUpSldbqHUlh0nanb3qO6x7fBZ+t55WBk9AO5J7AZJr7332YrDkmQ4ltplBcWtRwEpAySf2rCG4etdVb/7is22yMvSIy31RrLABwhLfd5XYEgFSlHonl0FR/MGOjBWkhCeJ1ZhKf5+o03JMd6leVMsqzE+suL4GWxK1dB0E6SYOp0ABPY3C9eMzREOSpmx6au90aScecoojpV9wFZOPcCvv0r4vNur3KRDvsK4WFThADshKXWQfutHT3IxXX6R8HejYUBtetLrOuc9QBcTFd8hhB7hOBxK9yR7CodvjpTarR18RZtvb5PnSmiUz2XHEvMMH9IdwCVeqeePXPKope4nmXC2he3akBJ/AYnx1/RRNTrDsGybjb5w6xQ4VgfOOKPMnQeqQDW74kuLPjNTYMlqRHfSFtOtLCkLSehBHIip5uJv/t3txIXbblcHJ1zR9UGCkOOI/nOQlHsTn7VnvTuutS7QbEM/C3h8XPWMl1doYUQU26In5XH0A8wpR6Dpkg9jnqNl9gLzuyXdRXe4PW6xh5SVSccciY5n5uDi7Z6rOefY86zbjNV5dhq1w1n+utIUZ1CQde3LWTsCNJMVrbXI+H2BfvsYf/tm1FKSNCsgwep0MpgSSQSCAJNUb8aumy+Eu6EuyGc/WmS0pWPXh/8AtVnbzePQe5qFI03dsTW08TkGSnypCB68J+ofdJIrxD/hC2nchmOwu9svcOBIE3iVn1KSnhPtgVGpfh61xondnTtmtF3eEWfLLsO9x08C47bY43eMdErCAeWeFWceoqn33MuFLQu8Ql1CiAeGJEmBsBGvUEd6r7tybjjS28PWph1KSocUwQBJ0JVOnIEHnBrYl6vln05bXrxfrlHgQo6eJx99YSlI9z1PoOpqH37xkaDt8lUexWC63dCTjzhwsNq+6ePmR+wqKbw7iag3r1+3p/TwelW1mUYdohtnlIXnBfUOmVYJBPJKfTnVg0V4O9MRbc2/ry7TJ89aQpbEN3yWGj+kHHEv3yPaqu47iuNXK2MESA2jQrPM+sjxoTGulUYyxgeXbNu5zIsl1wSG0zIHeIM9SSBOmsV2OmvGFt7dpSIt/tdzsYWcB90JeZT/ADFHMD9quFuuVvu8Fi52uazLiSUBxl5lYWhaT3BHWs5bgeD20Ktzs7bm6SmZrSSoQZzocaex+VK8AoPpnI9qnvh33Su+22tUaI1At5mz3KWYciM/kGDMKuELAP05V8qh05g9q9W2PYnhV0i0xtI4V6BY2nvGkddARvtXi8yxg2OWLl9ltZ429VNq3jtOs9NSDtoa2vSlKnlcvpSlKUrwO/dxk2rZ3VcuIopcNvUyCOoDig2f8KNQPwfQ7JCumqtY3iRHjos8JllLzyglLCHFLUtWT05NpH9xV633u+lLftjfIOq7q3DaucN2NHSfmcdeKcoCEjmohXCT6d8VgViVOTGcgNyXENS1N+cylwpbcUk/LxDocEnGema5nmy/Th2NMXUBfAk/DPP4onpuD6V2bIuFKxbLl1ZSW/tFj4o3T8MgddAR2nWr5vb4oJ2pRI0vt3Ieg2hWW5FyGUPyx0KW+7aD6/Ur7Dr+bJ+GCfqb4fU+4kd6DaDh1i3HKH5Y6gud20H0+oj0qh7HeGq06URF1brT4a63lSUvRmEEORomRkKB6OL/APXQfl9att+v1o0zaZN8vs9qHBiILjrzqsAAdvuT2A5k1m2GAP4k570x9U8wjkBvr0Hb9xOorXYpmm2wdn3JlZMSYU4NVKO3w8yf8v2gCDWMPFa40xuYzYYLDceFZ7RGjxWG0hKGkniVhIHQdK2FoayxNO6NslkgtJbZhwWWwAOp4AVH3JJJ+5rEMmRP343uS7GjuIRe7ghKEEZLEJvGVK9MNpJP3OK2Nt5urpLcN26wLBKQmRZpbkVbClDiW0hXCl5A7oVjkR079qt5VuGHsSurqQA4qEdwJJA8Dh08VdzxaXNvg9lZQSWkcTkawVQAT5Vxies9a9pXkt27i/aNsdUXKNkPMWqSW1DqlRbKcj2zXranG4uvNHSLuzs3PnNquGrIsmEopUCIhW0oNlz0K1ckjrn9szXEnUNWqwpQSVDhE/mVoPrXOcGYcevWyhBUEHiUB+VOqj4gH/yoB4N7JCm7gXO7PoSp21WwCOD+VTi+FSh/Skj9zWxqwdsprVzZvdJbeqG1xoxLlouySDlghfJwjuErGT/5JNbsiyo06M1MhSG32HkhbbragpK0noQRyIqL5EfaOHG3TotKjxDnrsf49KmntOtn04uLpWra0p4Ty03E+dfWa5axB4srPFsu7T82AlLarlb2JzgQMYeBUgq9z5aT71tW6XS3WW3yLtdprMSHFQXHnnVBKEJHUk1g/XN6m78bxkWVlzy7tJat1vSoYKIqeXmKHblxuH0zirWfHW1WbdqNXFKHCOfMT9Y9avey9h5GIO3x0ZQg8R5bgx9J7AVufTE566aatNzkHLsuCw+v+ZbaVH/Jrs64YURmBDYgRk8LMZpLLY9EpAA/wK5qnDQUlACt4rmrykrcUpAgEmPFKmW8O+untq4qoTbKrpf3m+KPAaBwjPRbygPkT9up7DuKbXEuHEdWXHIrK1K6qUgEmrF63cPMlFssIUeZEx4EjX/orKw560YuEuXjZcQPwhXDPkwdOsa9xWB4ds3R8Q2tVOuF6ZKV/wBsh5Km4kBknoB0Sn0SMqV9zzqpa68H0q36biy9C3VdxusVr+OjyiECWr9TXZBHThJwR3z11Q0wywCGWUNg8zwpAz/avxyTHZUlDr7aFL+kKUAT7VFbbJNmGl/fVFxxe6tiPG+vUmZ8VN7z2kYgXmvdyEstN7IGoPY6DToBEb761gK2643q2qzY2LhfrM20SBElRittH8qXEqSP6aL/AN6d7LgzGeTfL8UrygOILcVkn8x5JbT71vx8RFFDUkNErOEJcx8x+wPWv1TkaKlCFLaZCjhIJCQT6CsQZHcUPsXLtZa/L/xI+lZ59pTSSbhqwbD5/Hpv1+UK/wBvWo9tD4eLfoPTNyavU5bt/vsRcSVMiL4DEaWMeWwojII6lWOZA5YFZ41rsjujtFevxSxtz5cSMriiXa1BQcQntxpR8yD69U+hrdlK219lKxurZthqWy38pG/eesnXr3rRYbn3E7G8dun4dDvzJVtpoI6QNI1Ebg1gZzfTfGZHFoGr7wSfkw1ESl8/1pRx5/fNek2o8O2vdbXyPqLVYn2O2ofTKclPqKZshQIUPLB+ZJJA+dXTqATW0Uxo6XPNSw2F/qCRn+9cmQO/WtexkvjdS5iFwp0J2Bn+ST+kVtbr2jFDCmsKtEMFW6hBPoAlInzPioNv/wCHU69eVrDRflM34ICJUZxXC3OSkYB4uiXAOWTyIxnGM1na36o3q2hcVZ48q/WNCFH+FfYK2AfVKVpUj901v74qN5vk/ENeZnHBxjizjOMe1fM5cbO7cfwN2ZFXO8rz/hVLSXPLzji4euM96y8Tyk1d3BvLR0suHcp2PfQggnnB16TWDgufX7C0FhfspuGhsFbgdJIIIHKRI2mNKwVKuW9O88pq3vrvt/HFlLIaLcZB/UQAlse5rTmwewLO2LatR6idZl6jlNeX/wAfNuG2eqEHuo/mV+w5czYmlRkKMZktpUgBRbTgFIPQ47VyV6wrKbNhcffLlwuujYq5d9yZ8nxXjHM9XGKWvu+zaSwyd0p3PaQAAOoAE8zFKUpUsqCUpSlKUqT3rbC66m3lkarmNWwWmLBtyGvjraJanVodeW4llfmp8kgFOTwnmQeeMVWKUpUN3J0pLmao1K9edu7zqmRdojLOmJkJ1Ibty0tcJQVlaTEUHsul3GCCMElPDXDuXthuHqi5Wl1iDp+9zLXo9+M69eIy3o0i5FTXJsJdbLa18KzxkEAdhV4pSlRq+7Zam1A5twbFqC+2aXpqwyw1eJPA4+xLU3DQgS2OPgfK0B8LRkjIJCgQlVfDC0Jr/Su02pNAaPYnO3S86gmRYk+5TStaIkhwF6a66CVAlBdUOEZC1IASB0udKUqFR9NbiWHZOfoe4WB5+Xpu7wfwtFrkKf8AibW1OYfQhpbhStam2QtrC8E+WOua9PrX8d11E0LdLJp28wxB1hElzWJjXw7zUVtt5K3Fp4uaMqTy55yOVU6lKVPRtxZhvKrW3+lomPwkH47gHF8b5xBPXPF5ffHTvXjdD6Xuls3u1DdbxpqUBMvMuREmrsKVp8lUZsIUJ3m5Sn5VpCODqccutXSlKVCNN6SvVp3veusTR90W1Iuk+RNnXJhA8hlxKuByPNadHnNKPlhMZxtSmwSMpCATd6UpSlKUpSlKUpSlKUpSlKUpSlKUpSlKUpSlKUpSlKUpSlKUpSv/2Q==";

const EMPLOYEES = ["Nada","Sarah","David","Jimmy","Sonia","Harry","Farah","Fabienne","Ounza","Yael"];
const WORK_TYPES = ["ITE","PAC","Panneaux Solaires","Systeme Solaire Combine","Menuiseries Exterieures","Abri Jardin","Pergola","Carport"];
const WORK_COLORS = {"ITE":"#6366f1","PAC":"#E8501A","Panneaux Solaires":"#f59e0b","Systeme Solaire Combine":"#f97316","Menuiseries Exterieures":"#0891b2","Abri Jardin":"#059669","Pergola":"#7c3aed","Carport":"#be185d"};
const KWC_OPTIONS = ["3.375 kwc","3.5 kwc","3.75 kwc","4 kwc","4.125 kwc","4.5 kwc","5 kwc","5.25 kwc","5.5 kwc","6 kwc","6.75 kwc","7 kwc","7.5 kwc","8 kwc","8.25 kwc","9 kwc","Personnalise"];
const FORMALITES = ["Demande Prealable","Raccordement","Consuel","Recuperation de TVA"];
const RACC_STATUSES = ["Complet","Incomplet","En cours d instruction","Subvention accordee","En attente de paiement","Pas eligible","Mise en service programmée","Mise en service","Réenvoi"];
const RACC_STATUSES_WITH_DATE = ["Mise en service programmée","Mise en service","Réenvoi"];
const DP_STATUSES = ["Incomplet","Récépissé reçu","Réenvoi"];
const CONS_STATUSES = ["Avis de visite","À envoyer au CONSUEL","Envoyé au CONSUEL","Positif"];

const ALL_STATUSES = [
  {key:"en_attente",label:"En attente",color:"#d97706",bg:"#fffbeb"},
  {key:"en_cours_traitement",label:"En cours de traitement",color:"#E8501A",bg:"#FEF0EB"},
  {key:"accord_mairie",label:"Accord Mairie",color:"#059669",bg:"#ecfdf5"},
  {key:"accord_mairie_tacite",label:"Accord Mairie Tacite",color:"#059669",bg:"#ecfdf5"},
  {key:"annule",label:"Annule",color:"#dc2626",bg:"#fef2f2"},
  {key:"attente_recepisse",label:"Attente Recepisse Mairie",color:"#7c3aed",bg:"#f5f3ff"},
  {key:"attente_racco",label:"Attente Raccordement",color:"#0891b2",bg:"#ecfeff"},
  {key:"batiment_france",label:"Batiment de France",color:"#92400e",bg:"#fef3c7"},
  {key:"consuel_vise",label:"CONSUEL Vise",color:"#059669",bg:"#ecfdf5"},
  {key:"incomplet_mairie",label:"Incomplet Mairie",color:"#dc2626",bg:"#fef2f2"},
  {key:"manque_document",label:"Manque Document",color:"#dc2626",bg:"#fef2f2"},
  {key:"mise_en_service",label:"Mise en Service",color:"#059669",bg:"#ecfdf5"},
  {key:"recepisse_recu",label:"Recepisse Mairie Recu",color:"#6366f1",bg:"#eef2ff"},
  {key:"recepisse_racco",label:"Recepisse Racco Recu",color:"#0891b2",bg:"#ecfeff"},
  {key:"refus_mairie",label:"Refus Mairie",color:"#dc2626",bg:"#fef2f2"},
  {key:"valide",label:"Valide",color:"#059669",bg:"#ecfdf5"},
  {key:"termine",label:"Termine",color:"#374151",bg:"#f9fafb"},
];

const INIT_USERS = [
  {id:1,name:"Super Admin",email:"superadmin@crm.fr",password:"admin2024",role:"superadmin",initials:"SA",avatar:null},
  {id:2,name:"Admin",email:"admin@crm.fr",password:"admin123",role:"admin",initials:"AD",avatar:null},
  {id:3,name:"Sarah",email:"sarah@crm.fr",password:"sarah123",role:"employee",initials:"SR",avatar:null},
  {id:4,name:"BTS Partenaire",email:"partenaire@test.fr",password:"part123",role:"partenaire",initials:"BP",avatar:null},
  {id:5,name:"Nada",email:"nada@crm.fr",password:"nada123",role:"employee",initials:"NA",avatar:null},
  {id:6,name:"David",email:"david@crm.fr",password:"david123",role:"employee",initials:"DA",avatar:null},
  {id:7,name:"Yossi",email:"yossi@crm.fr",password:"yossi123",role:"employee",initials:"YO",avatar:null},
  {id:8,name:"Jimmy",email:"jimmy@crm.fr",password:"jimmy123",role:"employee",initials:"JI",avatar:null},
  {id:9,name:"Sonia",email:"sonia@crm.fr",password:"sonia123",role:"employee",initials:"SO",avatar:null},
  {id:10,name:"Harry",email:"harry@crm.fr",password:"harry123",role:"employee",initials:"HA",avatar:null},
  {id:11,name:"Farah",email:"farah@crm.fr",password:"farah123",role:"employee",initials:"FA",avatar:null},
  {id:12,name:"Fabienne",email:"fabienne@crm.fr",password:"fabienne123",role:"employee",initials:"FB",avatar:null},
  {id:13,name:"Ounza",email:"ounza@crm.fr",password:"ounza123",role:"employee",initials:"OU",avatar:null},
  {id:14,name:"Yael",email:"yael@crm.fr",password:"yael123",role:"employee",initials:"YA",avatar:null},
];

const INIT_CLIENTS_ORG = [
  {id:1,name:"Photo Ecologie",address:"12 rue de la Paix, 75001 Paris",siret:"123 456 789 00012",representant:"Marie Dupont",email:"contact@photoecologie.fr"},
  {id:2,name:"Globe Energy",address:"5 bd Haussmann, 75008 Paris",siret:"987 654 321 00034",representant:"Pierre Martin",email:"contact@globeenergy.fr"},
];

function genId(){const n=new Date();const p=x=>String(x).padStart(2,"0");return p(n.getDate())+"/"+p(n.getMonth()+1)+"/"+n.getFullYear();}
// Génère l'ID du dossier : N° DP si disponible, sinon fallback date
function dossierId(dp,fallback){return dp?dp.replace(/\s+/g," ").trim():fallback;}

function fmtDate(d){
  if(!d)return "";
  const dt=new Date(d);
  const p=x=>String(x).padStart(2,"0");
  return p(dt.getDate())+"/"+p(dt.getMonth()+1)+"/"+dt.getFullYear();
}
function timeAgo(d){
  if(!d)return "";
  const diff=Date.now()-new Date(d).getTime();
  const m=Math.floor(diff/60000),h=Math.floor(m/60),day=Math.floor(h/24),mo=Math.floor(day/30);
  if(mo>0)return mo+" mois";if(day>0)return day+"j";if(h>0)return h+"h";if(m>0)return m+"min";return "maintenant";
}

const MOCK = [
  {id:"15/11/2024",client:"Martin Dupont",client_org:"Photo Ecologie",email:"martin@example.com",phone:"06 12 34 56 78",address:"12 rue des Lilas, 75011 Paris",postal_code:"75011",dp_number:"DP 075 111 24 00001",parcelle:"AB 0012",
   works:[{type:"PAC",formalites:["Raccordement"],kwc:""},{type:"ITE",formalites:["Consuel"],kwc:""}],
   status:"en_cours",assignee:"Sarah",created:"2024-11-15",updated:"2025-03-10",paid:false,amount:1200,installed:false,
   docs:[{name:"Devis_Martin.pdf",size:"245 KB",date:"2024-11-15",url:null}],
   comments:[{author:"Sarah",date:"2024-11-20",text:"Dossier en attente de validation EDF.",from_client:false}],
   avancement:{dp_checked:true,dp_envoi:"2024-11-16",dp_note:"",racc_checked:false,racc_date:"",racc_status:"",racc_note:"",cons_checked:false,cons_date:"",cons_note:"",tva_checked:false,tva_date:"",tva_note:""}},
  {id:"08/10/2024",client:"Emilie Rousseau",client_org:"Globe Energy",email:"emilie@example.com",phone:"06 98 76 54 32",address:"5 avenue Victor Hugo, 69001 Lyon",postal_code:"69001",dp_number:"DP 069 011 24 00042",parcelle:"",
   works:[{type:"Panneaux Solaires",formalites:["Recuperation de TVA"],kwc:"6 kwc"}],
   status:"valide",assignee:"Nada",created:"2024-10-08",updated:"2025-02-28",paid:true,amount:800,installed:true,
   docs:[{name:"Facture_Panneaux.pdf",size:"180 KB",date:"2024-10-10",url:null}],
   comments:[{author:"Nada",date:"2024-11-30",text:"Dossier valide, TVA recuperee.",from_client:false}],
   avancement:{dp_checked:true,dp_envoi:"2024-10-15",dp_note:"Envoye par AR",racc_checked:true,racc_date:"2024-11-01",racc_status:"Complet",racc_note:"RAS",cons_checked:true,cons_date:"2024-11-20",cons_note:"",tva_checked:true,tva_date:"2024-11-30",tva_note:""}},
  {id:"05/12/2024",client:"Jean-Pierre Moreau",client_org:"Globe Energy",email:"jp@example.com",phone:"07 11 22 33 44",address:"28 chemin du Moulin, 13300 Salon-de-Provence",postal_code:"13300",dp_number:"DP 013 055 24 00078",parcelle:"CD 0034",
   works:[{type:"Menuiseries Exterieures",formalites:["Demande Prealable"],kwc:""}],
   status:"nouveau",assignee:"Jimmy",created:"2024-12-05",updated:"2025-03-09",paid:false,amount:2500,installed:false,
   docs:[],comments:[],
   avancement:{dp_checked:false,dp_envoi:"",dp_note:"",racc_checked:false,racc_date:"",racc_status:"",racc_note:"",cons_checked:false,cons_date:"",cons_note:"",tva_checked:false,tva_date:"",tva_note:""}},
];

// ── Extraction texte universelle (PDF natif + OCR images/scans) ──
async function ocrImage(src){
  const{data:{text}}=await Tesseract.recognize(src,"fra",{logger:()=>{}});
  return text||"";
}
async function pdfToText(file,maxPages=5){
  const buf=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise;
  let txt="";
  for(let i=1;i<=Math.min(pdf.numPages,maxPages);i++){const pg=await pdf.getPage(i);const ct=await pg.getTextContent();let prev=null;ct.items.forEach(it=>{if(prev&&it.transform&&prev.transform){if(Math.abs(it.transform[4]-(prev.transform[4]+(prev.width||0)))>3)txt+=" ";}txt+=it.str;prev=it;});txt+="\n";}
  return txt;
}
async function ocrScannedPdf(file,maxPages=3){
  const buf=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data:new Uint8Array(buf)}).promise;
  let txt="";
  for(let i=1;i<=Math.min(pdf.numPages,maxPages);i++){
    const pg=await pdf.getPage(i);const vp=pg.getViewport({scale:2.0});
    const c=document.createElement("canvas");c.width=vp.width;c.height=vp.height;
    await pg.render({canvasContext:c.getContext("2d"),viewport:vp}).promise;
    txt+=await ocrImage(c.toDataURL("image/png"))+"\n";
  }
  return txt;
}
async function extractTextUniversal(file,maxPages=3){
  if(file.type?.startsWith("image/"))return await ocrImage(file);
  const txt=await pdfToText(file,maxPages);
  if(txt.replace(/\s/g,"").length<30)return await ocrScannedPdf(file,maxPages);
  return txt;
}

// DP extraction (PDF + images + scans)
async function extractDP(file){
  try{
    const txt=await extractTextUniversal(file);
    const pats=[
      /DP[\s\-\.\/]?(\d{3})[\s\-\.\/]?(\d{3})[\s\-\.\/]?(\d{2})[\s\-\.\/]?(\d{5})/gi,
      /DP[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{2,4}[\s\-]?\d{3,6}/gi,
      /\bDP\s{0,3}\d[\d\s\-]{10,18}\d\b/gi,
      /\bDP[°]?\s{0,3}\d{5}[\s\-]?\d{2}[\s\-]?[A-Z][\dA-Z]{0,5}/gi,
      /(?:N°\s*)?DP[°]?\s{0,3}(\d{3}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?[A-Z]{1,2}[\s\-]?\d{2,5})/gi,
      /(?:N°\s*)?DP[°]?\s{0,3}(\d{7}[A-Z]\d{5})/gi,
      /N[°o]\s*DP\s{0,3}([\dA-Z][\dA-Z\s\-]{9,17}[\dA-Z])/gi,
      /\bDP[°]?\s{1,3}[\dA-Z][\dA-Z\s\-]{8,20}[\dA-Z]\b/gi,
    ];
    for(const p of pats){const m=txt.match(p);if(m){
      const raw=m[0].trim();const digits=raw.replace(/[^0-9]/g,"");
      if(digits.length>=13&&!/[A-Z]/i.test(raw.replace(/^.*?DP[°]?\s*/i,"").replace(/[\s\-\.\/]/g,"").slice(0,13)))
        return`DP ${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6,8)} ${digits.slice(8,13)}`;
      return raw.replace(/\s+/g," ").slice(0,50);
    }}
    return null;
  }catch{return null;}
}

// KBIS extraction (PDF + images + scans)
async function extractKbis(file){
  try{
    const raw=await extractTextUniversal(file,2);
    const lines=raw.split("\n").map(l=>l.replace(/\s{2,}/g," ").trim()).filter(l=>l.length>0);
    const text=lines.join("\n");

    // Helper : cherche la valeur après un label (même ligne ou ligne suivante)
    function after(lbl){
      for(let i=0;i<lines.length;i++){
        if(!new RegExp(lbl,"i").test(lines[i]))continue;
        const m=lines[i].match(new RegExp(lbl+"[\\s:;–\\-]*(.+)","i"));
        if(m){const v=m[1].trim().replace(/^[:;–\-\s]+/,"");if(v.length>1)return v;}
        if(i+1<lines.length){const n=lines[i+1].trim().replace(/^[:;–\-\s]+/,"");if(n.length>1)return n;}
        return null;
      }
      return null;
    }

    // ── 1. Nom entreprise (dénomination uniquement) ──
    let company_name=after("D[eé]nomination\\s+sociale")||after("D[eé]nomination")||after("Raison\\s+sociale")||null;
    if(company_name){
      company_name=company_name
        .replace(/^.*(?:raison\s+sociale|d[eé]nomination\s+sociale?)\s*/i,"")
        .replace(/\b(Forme\s+juridique|Forme|SIREN|SIRET|Capital|Adresse|Activit|Immatricul|Greffe|Date|Dur[eé]e|Enseigne|Sigle|Nom\s+commercial|Domiciliation|Num[eé]ro|N°|Objet|Soci[eé]t[eé]\s+par).*/i,"")
        .replace(/\.{2,}/g,"").replace(/\s{2,}/g," ").trim();
    }

    // ── 2. SIRET via annuaire-entreprises.data.gouv.fr (recherche par nom) ──
    let siret=null;
    let apiAdresse=null;
    let apiRepresentant=null;
    const norm=s=>(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
    if(company_name){
      try{
        const res=await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(company_name)}&page=1&per_page=3`);
        if(res.ok){
          const json=await res.json();
          const hit=(json.results||[]).find(r=>norm(r.nom_complet)===norm(company_name))||(json.results||[])[0];
          if(hit?.siege?.siret){
            const d=hit.siege.siret.replace(/[\s.]/g,"");
            siret=d.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/,"$1 $2 $3 $4");
            if(hit.siege.geo_adresse)apiAdresse=hit.siege.geo_adresse;
            // Dirigeant depuis l'API
            const dir=hit.dirigeants?.find(d=>d.type_dirigeant==="personne physique");
            if(dir){
              const prenom=(dir.prenoms||"").split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(" ");
              const nom=(dir.nom||"").charAt(0).toUpperCase()+(dir.nom||"").slice(1).toLowerCase();
              apiRepresentant=(prenom+" "+nom).trim();
            }
          }
        }
      }catch{}
    }
    // Fallback : extraction depuis le texte du KBIS si l'API n'a rien donné
    if(!siret){
      const rcsIdx=lines.findIndex(l=>/Immatriculation\s+au\s+RCS|RCS\s|SIREN/i.test(l));
      if(rcsIdx>=0){
        const block=lines.slice(rcsIdx,rcsIdx+3).join(" ");
        const numM=block.match(/\b(\d{3}[\s.]?\d{3}[\s.]?\d{3}[\s.]?\d{5})\b/)||block.match(/\b(\d{3}[\s.]?\d{3}[\s.]?\d{3})\b/);
        if(numM){const d=numM[1].replace(/[\s.]/g,"");
          if(d.length===14)siret=d.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/,"$1 $2 $3 $4");
          else if(d.length===9)siret=d.replace(/(\d{3})(\d{3})(\d{3})/,"$1 $2 $3");
        }
      }
    }
    if(!siret){const fb=text.match(/\b(\d{3}[\s.]?\d{3}[\s.]?\d{3}[\s.]?\d{5})\b/);if(fb){const d=fb[1].replace(/[\s.]/g,"");siret=d.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/,"$1 $2 $3 $4");}}

    // ── 3. Adresse du siège uniquement ──
    let address=after("Adresse\\s+du\\s+si[èe]ge\\s+social")||after("Adresse\\s+du\\s+si[èe]ge")||after("Si[èe]ge\\s+social")||null;
    if(address){
      // Si pas de code postal, concaténer la ligne suivante
      if(!/\d{5}/.test(address)){
        const idx=lines.findIndex(l=>/Si[èe]ge|Adresse\s+du\s+si[èe]ge/i.test(l));
        if(idx>=0&&idx+2<lines.length){const extra=lines[idx+2].trim();if(/\d{5}/.test(extra))address=address+" "+extra;}
      }
      address=address
        .replace(/\b(Domiciliation|Activit|Forme|Capital|Dur[eé]e|Date|Greffe|Immatricul|SIREN|SIRET|Repr[eé]sentant|G[eé]rant|Pr[eé]sident|Nom\s+ou|Enseigne|Objet|Description|en\s+commun|Transfert).*/i,"")
        .replace(/\.{2,}/g,"").replace(/\s{2,}/g," ").trim();
    }

    // ── 4. Représentant : Prénom Nom uniquement ──
    let representant=null;
    // Chercher "Nom, prénoms NAKACHE Aaron" → extraire NOM + Prénom
    const npMatch=text.match(/Nom,?\s*pr[eé]noms?\s*[:\s]*([A-ZÀ-Ü]{2,}(?:[\s\-]+[A-ZÀ-Ü]{2,})*)\s+([A-ZÀ-Ü][a-zà-ü]+(?:[\s\-]+[A-ZÀ-Ü][a-zà-ü]+)*)/i);
    if(npMatch){representant=npMatch[2]+" "+npMatch[1];} // Prénom NOM

    if(!representant){
      const roles=[/Repr[eé]sentant(?:s)?\s+l[eé]gaux?/i,/G[eé]rant/i,/Pr[eé]sident/i,/Directeur\s+g[eé]n[eé]ral/i,/Dirigeant/i];
      for(const rp of roles){
        const idx=lines.findIndex(l=>rp.test(l));
        if(idx<0)continue;
        const block=lines.slice(idx,idx+4).join("\n");
        // "Nom, prénoms" dans le bloc
        const np2=block.match(/Nom,?\s*pr[eé]noms?\s*[:\s]*([A-ZÀ-Ü]{2,}(?:[\s\-]+[A-ZÀ-Ü]{2,})*)\s+([A-ZÀ-Ü][a-zà-ü]+(?:[\s\-]+[A-ZÀ-Ü][a-zà-ü]+)*)/i);
        if(np2){representant=np2[2]+" "+np2[1];break;}
        // Civilité + Nom
        const civ=block.match(/\b(?:M[me.r]{0,3}|Madame|Monsieur)\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)*(?:\s+[A-ZÀ-Ü]{2,})?)/);
        if(civ){representant=civ[1].trim();break;}
        // NOM Prénom (majuscules)
        const nm=block.match(/\b([A-ZÀ-Ü]{2,}(?:\s+[A-ZÀ-Ü]{2,})*)\s+([A-ZÀ-Ü][a-zà-ü]+(?:[\s-][A-ZÀ-Ü][a-zà-ü]+)*)\b/);
        if(nm){representant=nm[2]+" "+nm[1];break;}
        // Fallback ligne suivante
        if(idx+1<lines.length){const n=lines[idx+1].trim().replace(/^[:;–\-\s]+/,"");
          if(n&&/^[A-ZÀ-Üa-zà-ü\s\-'.]{2,60}$/.test(n)&&!/\d/.test(n)&&n.split(/\s+/).length<=5){representant=n;break;}}
      }
    }
    if(representant){
      representant=representant
        .replace(/^.*Nom,?\s*pr[eé]noms?\s*/i,"")
        .replace(/\b(n[eé]e?\s+le|dat[eé]|depuis|nomm[eé]|Adresse|Activit|Forme|Capital|Greffe|Immatricul|SIREN|Nationalit|Domiciliation).*/i,"")
        .replace(/,.*/,"").replace(/\.{2,}/g,"").replace(/\s{2,}/g," ").trim();
    }

    // Utiliser les données API en priorité pour adresse et représentant si le PDF n'a rien donné de propre
    if(!address&&apiAdresse)address=apiAdresse;
    if(!representant&&apiRepresentant)representant=apiRepresentant;

    const clean=v=>{if(!v)return null;let c=v.replace(/\.{2,}/g,"").replace(/^\W+/,"").replace(/\s{2,}/g," ").trim();return(c.length<2||/^[\W\d]+$/.test(c))?null:c;};
    // Ne pas passer siret dans clean() car il ne contient que des chiffres/espaces
    return {siret:siret||null,company_name:clean(company_name),address:clean(address)||apiAdresse,representant:clean(representant)||apiRepresentant};
  }catch{return null;}
}

async function extractClientData(file){
  try{
    const raw=await extractTextUniversal(file,2);
    const text=raw.split("\n").map(l=>l.replace(/\s{2,}/g," ").trim()).filter(Boolean).join("\n");
    let nom="",prenom="",email="",phone="",address="",organisme="";
    // Email
    const em=text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    if(em)email=em[0];
    // Phone (French)
    const ph=text.match(/(?:(?:\+33|0033)\s*[1-9]|0[1-9])[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}[\s.\-]?\d{2}/);
    if(ph)phone=ph[0].trim();
    // Nom / Prénom via M. / Mme patterns
    const np=text.match(/\b(?:M\.|Mr\.?|Mme\.?|Madame|Monsieur)\s+([A-ZÀ-Ü][a-zà-ÿ\-]+)\s+([A-ZÀ-Ü][A-ZÀ-Üa-zà-ÿ\-]+)/);
    if(np){prenom=np[1];nom=np[2];}
    else{const np2=text.match(/(?:Nom|Client|Bénéficiaire|Titulaire)\s*[:]\s*([A-ZÀ-Ü][a-zà-ÿ\-]+)\s+([A-ZÀ-Ü][A-ZÀ-Üa-zà-ÿ\-]+)/i);if(np2){prenom=np2[1];nom=np2[2];}}
    // Address
    const ad=text.match(/\d{1,4}[\s,]+(?:rue|avenue|boulevard|chemin|impasse|allée|place|route|cours|passage|voie)\s+[^\n]{3,60}(?:[\s,]+\d{5}[\s,]+[A-ZÀ-Ü][a-zà-ÿ\-]+(?:[\s\-]+[A-ZÀ-Ü]?[a-zà-ÿ\-]+)*)?/i);
    if(ad)address=ad[0].trim();
    // Organisme / Société
    const org=text.match(/(?:Soci[eé]t[eé]|Entreprise|Organisme|Raison\s+sociale|SAS|SARL|EURL|SCI)\s*[:.]?\s*([^\n]{2,60})/i);
    if(org)organisme=org[1].trim().replace(/^[:–\-\s]+/,"");
    return {nom,prenom,email,phone,address,organisme};
  }catch{return null;}
}

// CSS
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=DM+Mono:wght@400;500&display=swap');
:root{--or:#E8501A;--or-l:#FEF0EB;--or-d:#c43e10;--bg:#F5F5F0;--bg2:#ffffff;--bg3:#FAFAF8;--bd:#E8E8E0;--bd2:#D0D0C8;--tx:#1A1A16;--tx2:#3D3D35;--tx3:#6B6B60;--tx4:#A0A090;--gr:#1A7A4A;--gr-l:#EDFAF3;--re:#C8260E;--re-l:#FEF0EE;--bl:#1A4A8A;--bl-l:#EEF3FD;--pu:#6B35C8;--pu-l:#F3EFFE;--ff:'DM Sans',-apple-system,sans-serif;--fm:'DM Mono',monospace;--sh:0 1px 3px rgba(0,0,0,.06);--shm:0 4px 14px rgba(0,0,0,.09);--shl:0 16px 40px rgba(0,0,0,.14),0 4px 10px rgba(0,0,0,.07);--r:10px;--rl:14px;}
[data-theme="dark"]{--bg:#0E0E0D;--bg2:#1A1A18;--bg3:#222220;--bd:#2A2A28;--bd2:#363634;--tx:#F2F2EE;--tx2:#D0D0C8;--tx3:#909088;--tx4:#585850;--or-l:rgba(232,80,26,.18);--gr-l:rgba(26,122,74,.18);--re-l:rgba(200,38,14,.18);--bl-l:rgba(26,74,138,.18);--pu-l:rgba(107,53,200,.18);}
*{box-sizing:border-box;margin:0;padding:0;}body,html,#root{font-family:var(--ff);font-size:15.4px;color:var(--tx);background:var(--bg);min-height:100vh;-webkit-font-smoothing:antialiased;}
::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-thumb{background:var(--bd2);border-radius:4px;}
.app{display:flex;min-height:100vh;}
/* SIDEBAR — dark bg, white text always */
.sb{width:248px;background:#141412;display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:100;transition:transform .3s;}
.sb-logo{padding:15px 16px 13px;border-bottom:1px solid rgba(255,255,255,.1);}
.sb-logo img{height:29px;width:auto;object-fit:contain;}
.sb-srch{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08);position:relative;}
.sb-srch input{width:100%;padding:8px 10px 8px 30px;background:rgba(255,255,255,.09);border:1.5px solid rgba(255,255,255,.14);border-radius:8px;color:#fff;font-size:12px;outline:none;font-family:var(--ff);transition:.15s;}
.sb-srch input::placeholder{color:rgba(255,255,255,.38);}
.sb-srch input:focus{background:rgba(255,255,255,.13);border-color:#E8501A;}
.sb-srch-ic{position:absolute;left:21px;top:50%;transform:translateY(-50%);opacity:.45;pointer-events:none;}
.sb-nav{flex:1;padding:10px;overflow-y:auto;}
.nvsec{font-size:9px;font-weight:700;color:rgba(255,255,255,.3);letter-spacing:.14em;text-transform:uppercase;padding:0 10px;margin:14px 0 4px;}
.nvi{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:500;color:rgba(255,255,255,.72);margin-bottom:2px;transition:all .15s;}
.nvi:hover{background:rgba(255,255,255,.09);color:#fff;}
.nvi.act{background:#E8501A;color:#fff;font-weight:700;box-shadow:0 2px 10px rgba(232,80,26,.45);}
.nvi svg{opacity:.85;flex-shrink:0;}
.nvi.act svg{opacity:1;}
.nvbdg{margin-left:auto;background:rgba(255,255,255,.18);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;}
.nvi.act .nvbdg{background:rgba(255,255,255,.3);}
.sb-usr{padding:12px 14px;border-top:1px solid rgba(255,255,255,.1);display:flex;align-items:center;gap:9px;}
.sb-usr .unm{font-size:12px;font-weight:600;color:rgba(255,255,255,.9);}
.sb-usr .uro{font-size:9px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.06em;}
/* MAIN */
.main{margin-left:248px;flex:1;display:flex;flex-direction:column;min-height:100vh;}
.topbar{background:var(--bg2);border-bottom:2px solid var(--bd);padding:0 12px;height:56px;display:flex;align-items:center;gap:8px;position:sticky;top:0;z-index:50;overflow:hidden;}
.tb-ttl{font-size:16px;font-weight:800;color:var(--tx);white-space:nowrap;letter-spacing:-.025em;flex-shrink:0;}
.tb-flt{display:flex;align-items:center;gap:5px;flex:1;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none;}
.tb-flt::-webkit-scrollbar{display:none;}
.content{padding:22px;flex:1;}
/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:var(--r);font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all .15s;white-space:nowrap;font-family:var(--ff);}
.btn-p{background:var(--or);color:#fff;}.btn-p:hover{background:var(--or-d);box-shadow:0 4px 14px rgba(232,80,26,.4);transform:translateY(-1px);}
.btn-s{background:var(--bg2);color:var(--tx2);border:1.5px solid var(--bd);}.btn-s:hover{background:var(--bg3);}
.btn-d{background:var(--re-l);color:var(--re);border:1.5px solid #fbb;}.btn-d:hover{background:#fde8e8;}
.btn-g{background:var(--gr-l);color:var(--gr);border:1.5px solid #a7f3d0;}
.btn-sm{padding:5px 10px;font-size:12px;}
.bic{padding:6px;border-radius:7px;background:var(--bg3);border:1.5px solid var(--bd);color:var(--tx3);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;}
.bic:hover{background:var(--bg2);color:var(--tx);}
.dtog{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:var(--bg3);border:1.5px solid var(--bd);cursor:pointer;font-size:14px;flex-shrink:0;}
.tb-xls{transition:border-color .15s,box-shadow .15s;}.tb-xls:hover{border-color:var(--or)!important;box-shadow:0 0 0 1px var(--or);}
/* CARDS */
.card{background:var(--bg2);border:1.5px solid var(--bd);border-radius:var(--rl);padding:18px;box-shadow:var(--sh);}
.scard{background:var(--bg2);border:1.5px solid var(--bd);border-radius:var(--rl);padding:16px;position:relative;overflow:hidden;box-shadow:var(--sh);transition:all .2s;}
.scard:hover{box-shadow:var(--shm);transform:translateY(-1px);}
.scard::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--sc,#E8501A);}
/* BADGES & CHIPS */
.sbdg{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;}
.sdot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.chip{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap;}
.wchip{display:inline-flex;align-items:center;padding:3px 9px;border-radius:5px;font-size:11px;font-weight:700;color:#fff;white-space:nowrap;}
.asgn{display:inline-flex;align-items:center;gap:5px;background:var(--bg3);border:1.5px solid var(--bd);border-radius:20px;padding:3px 10px 3px 3px;font-size:12px;font-weight:500;color:var(--tx2);}
.av-ico{width:20px;height:20px;border-radius:50%;background:var(--or);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;overflow:hidden;}
.av-ico img{width:100%;height:100%;object-fit:cover;}
.ago{font-size:10px;color:var(--tx4);font-weight:500;}
/* SEARCH / FILTER */
.srch{padding:7px 10px 7px 32px;background:var(--bg2);border:1.5px solid var(--bd);border-radius:var(--r);color:var(--tx);font-size:12px;outline:none;font-family:var(--ff);transition:.15s;width:100%;}
.srch:focus{border-color:var(--or);box-shadow:0 0 0 3px rgba(232,80,26,.1);}
.srw{position:relative;}
.srw-ic{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--tx4);pointer-events:none;}
.fsel{padding:6px 9px;background:var(--bg2);border:1.5px solid var(--bd);border-radius:var(--r);color:var(--tx2);font-size:11px;outline:none;cursor:pointer;font-family:var(--ff);font-weight:500;transition:.15s;}
.fsel:focus,.fsel.on{border-color:var(--or);}
/* TABLE */
table{width:100%;border-collapse:collapse;}
thead tr{border-bottom:2px solid var(--bd);}
th{text-align:left;padding:10px 11px;font-size:10px;font-weight:800;color:var(--tx2);text-transform:uppercase;letter-spacing:.1em;white-space:nowrap;background:var(--bg3);}
tbody tr{border-bottom:1px solid var(--bd);cursor:pointer;transition:background .1s;}
tbody tr:hover{background:var(--bg3);}
td{padding:11px;font-size:13px;vertical-align:middle;color:var(--tx2);}
/* MODAL */
.ov{position:fixed;inset:0;background:rgba(14,14,13,.65);backdrop-filter:blur(5px);z-index:200;display:flex;align-items:center;justify-content:center;padding:12px;}
.modal{background:var(--bg2);border:1.5px solid var(--bd);border-radius:var(--rl);width:100%;max-width:960px;max-height:96vh;overflow-y:auto;box-shadow:var(--shl);}
.mhdr{padding:18px 24px 14px;border-bottom:1.5px solid var(--bd);display:flex;align-items:flex-start;justify-content:space-between;gap:12px;position:sticky;top:0;background:var(--bg2);z-index:10;}
.mbdy{padding:20px 24px;}
.mftr{padding:13px 24px;border-top:1.5px solid var(--bd);display:flex;gap:9px;justify-content:flex-end;background:var(--bg3);position:sticky;bottom:0;}
/* FORM */
.fg{display:flex;flex-direction:column;gap:5px;}
.lbl{font-size:10px;font-weight:800;color:var(--tx3);text-transform:uppercase;letter-spacing:.09em;}
.lbl-h{font-size:11px;font-weight:800;color:var(--tx);text-transform:uppercase;letter-spacing:.07em;display:block;padding-bottom:7px;border-bottom:2.5px solid var(--or);margin-bottom:12px;}
input,select,textarea{background:var(--bg2);border:1.5px solid var(--bd);border-radius:var(--r);color:var(--tx);padding:8px 10px;font-size:13px;outline:none;transition:.15s;width:100%;font-family:var(--ff);}
input:focus,select:focus,textarea:focus{border-color:var(--or);box-shadow:0 0 0 3px rgba(232,80,26,.1);}
textarea{resize:vertical;min-height:70px;}
input[type=checkbox]{width:17px;height:17px;accent-color:var(--or);cursor:pointer;flex-shrink:0;}
/* TABS — bold & visible */
.tabs{display:flex;border-bottom:2.5px solid var(--bd);margin-bottom:18px;overflow-x:auto;gap:2px;}
.tab{padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer;color:var(--tx3);border:none;background:transparent;border-bottom:3px solid transparent;margin-bottom:-2.5px;font-family:var(--ff);white-space:nowrap;transition:all .15s;border-radius:var(--r) var(--r) 0 0;}
.tab:hover:not(.act){color:var(--tx);background:var(--bg3);}
.tab.act{color:var(--or);font-weight:800;border-bottom-color:var(--or);background:var(--or-l);}
/* DOCS */
.docit{display:flex;align-items:center;gap:9px;padding:10px 13px;background:var(--bg3);border:1.5px solid var(--bd);border-radius:var(--r);margin-bottom:7px;cursor:pointer;transition:all .15s;}
.docit:hover{background:var(--bg2);border-color:var(--bd2);}
.upz{border:2px dashed var(--bd2);border-radius:var(--rl);padding:28px;text-align:center;cursor:pointer;transition:all .2s;background:var(--bg3);margin-bottom:14px;}
.upz:hover,.upz.drag{border-color:var(--or);background:var(--or-l);}
/* COMMENTS */
.cmt{padding:12px 14px;background:var(--bg3);border-radius:var(--r);border-left:3px solid var(--or);margin-bottom:8px;}
.cmt.cli{border-left-color:#059669;background:var(--gr-l);}
/* AVANCEMENT — 2 col layout */
.av-section{background:var(--bg2);border:1.5px solid var(--bd);border-radius:var(--rl);margin-bottom:14px;overflow:hidden;}
.av-head{padding:12px 16px;background:var(--bg3);border-bottom:1.5px solid var(--bd);display:flex;align-items:center;gap:10px;}
.av-body{display:grid;grid-template-columns:1fr 1fr;gap:0;}
.av-left{padding:16px;border-right:1.5px solid var(--bd);}
.av-right{padding:16px;}
.av-dot{width:22px;height:22px;border-radius:50%;border:2.5px solid var(--bd2);background:var(--bg2);cursor:pointer;transition:all .2s;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
.av-dot.done{background:var(--gr);border-color:var(--gr);}
.av-dot:hover:not(.done){border-color:var(--gr);background:var(--gr-l);}
/* NOTIFS */
.ntfdot{width:8px;height:8px;border-radius:50%;background:#ef4444;position:absolute;top:4px;right:4px;animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
.ntfit{padding:10px 14px;border-bottom:1px solid var(--bd);cursor:pointer;transition:background .1s;}
.ntfit.unread{background:var(--or-l);}
.ntfit:hover{background:var(--bg3);}
/* AVATAR */
.av{width:32px;height:32px;border-radius:50%;background:var(--or);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden;}
.av img{width:100%;height:100%;object-fit:cover;}
/* TOASTS */
.toast-c{position:fixed;bottom:18px;right:18px;z-index:999;display:flex;flex-direction:column;gap:6px;}
.toast{background:var(--bg2);border:1.5px solid var(--bd);border-radius:var(--r);padding:12px 14px;display:flex;align-items:center;gap:9px;box-shadow:var(--shl);min-width:240px;max-width:340px;color:var(--tx);animation:tsi .25s ease;}
@keyframes tsi{from{opacity:0;transform:translateX(14px);}to{opacity:1;transform:translateX(0);}}
.toast.s{border-left:3px solid var(--gr);}.toast.e{border-left:3px solid var(--re);}.toast.i{border-left:3px solid var(--or);}
/* LOGIN */
.lpg{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#141412;position:relative;overflow:hidden;}
.lpg::before{content:"";position:absolute;width:500px;height:500px;background:radial-gradient(circle,rgba(232,80,26,.2) 0%,transparent 70%);top:-80px;right:-80px;}
.lcard{background:var(--bg2);border-radius:18px;padding:38px 34px;width:100%;max-width:400px;box-shadow:var(--shl);position:relative;z-index:1;}
@media(max-width:768px){.login-left-panel{display:none!important;}.login-mobile-logo{display:block!important;}}
/* MISC */
.sec{font-size:11px;font-weight:800;color:var(--tx2);text-transform:uppercase;letter-spacing:.09em;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid var(--bd);}
.conf-ov{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:300;display:flex;align-items:center;justify-content:center;}
.conf-box{background:var(--bg2);border-radius:var(--rl);padding:28px;max-width:360px;width:90%;box-shadow:var(--shl);text-align:center;}
.fmt-btn{display:inline-flex;align-items:center;padding:5px 10px;border-radius:var(--r);border:1.5px solid var(--bd);background:var(--bg3);color:var(--tx3);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;font-family:var(--ff);}
.fmt-btn:hover{border-color:var(--or);color:var(--or);}
.fmt-btn.sel{background:var(--or);color:#fff;border-color:var(--or);}
.pr-ov{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;}
.pr-box{background:#fff;border-radius:var(--rl);max-width:800px;width:100%;max-height:90vh;overflow:auto;box-shadow:var(--shl);display:flex;flex-direction:column;}
.pr-hdr{padding:12px 16px;background:var(--bg3);border-bottom:1.5px solid var(--bd);display:flex;justify-content:space-between;align-items:center;}
@media(max-width:768px){.sb{transform:translateX(-100%);}.sb.open{transform:translateX(0);}.main{margin-left:0;}.content{padding:13px;}.topbar{padding:0 13px;}.tb-flt{display:none;}.av-body{grid-template-columns:1fr;}.av-left{border-right:none;border-bottom:1.5px solid var(--bd);}}
`;

// ── ICONS ──
function Ic({n,s=16,c="currentColor"}){
  const d={
    folder:<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>,
    plus:<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    search:<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    users:<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
    bell:<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>,
    upload:<><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></>,
    dl:<><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></>,
    check:<polyline points="20 6 9 17 4 12" strokeWidth="2.5"/>,
    x:<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    edit:<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    trash:<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>,
    eye:<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    mail:<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
    credit:<><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
    bar:<><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></>,
    import:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    lock:<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,
    logout:<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    msg:<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>,
    scan:<><path d="M3 7V5a2 2 0 012-2h2"/><path d="M17 3h2a2 2 0 012 2v2"/><path d="M21 17v2a2 2 0 01-2 2h-2"/><path d="M7 21H5a2 2 0 01-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/></>,
    cam:<><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></>,
    home:<><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></>,
    menu:<><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    prog:<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
    file:<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    bld:<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d[n]}</svg>;
}

function SBadge({status}){
  const s=ALL_STATUSES.find(x=>x.key===status)||ALL_STATUSES[0];
  return <span className="sbdg" style={{background:s.bg,color:s.color,border:"1px solid "+s.color+"40"}}><span className="sdot" style={{background:s.color}}/>{s.label}</span>;
}
function WChip({type}){
  const col=WORK_COLORS[type]||"#6366f1";
  return <span className="wchip" style={{background:col}}>{type}</span>;
}
function Toasts({ts,rm}){
  return <div className="toast-c">{ts.map(t=><div key={t.id} className={"toast "+t.type}><span style={{fontSize:13,color:t.type==="s"?"var(--gr)":t.type==="e"?"var(--re)":"var(--or)"}}>{t.type==="s"?"✓":t.type==="e"?"✕":"ℹ"}</span><span style={{flex:1,fontSize:12}}>{t.msg}</span><button onClick={()=>rm(t.id)} style={{background:"none",border:"none",color:"var(--tx4)",cursor:"pointer",display:"flex"}}><Ic n="x" s={11}/></button></div>)}</div>;
}
function Confirm({msg,onOk,onNo}){
  return <div className="conf-ov"><div className="conf-box"><div style={{fontSize:32,marginBottom:10}}>⚠️</div><h3 style={{fontSize:15,fontWeight:700,marginBottom:7}}>{msg}</h3><p style={{fontSize:12,color:"var(--tx3)",marginBottom:18}}>Cette action est irreversible.</p><div style={{display:"flex",gap:9,justifyContent:"center"}}><button className="btn btn-s" onClick={onNo}>Annuler</button><button className="btn btn-d" onClick={onOk}>Supprimer</button></div></div></div>;
}

// ── LOGIN ──
function Login({onLogin}){
  const [em,setEm]=useState("");const [pw,setPw]=useState("");const [err,setErr]=useState("");const [loading,setLoading]=useState(false);const [showPw,setShowPw]=useState(false);
  const go=async()=>{
    if(!em.trim()||!pw.trim()){setErr("Veuillez remplir tous les champs.");return;}
    setErr("");setLoading(true);
    try{
      const u=await apiLogin(em,pw);
      if(u)onLogin(u);
      else setErr("Email ou mot de passe incorrect.");
    }catch(e){setErr(e.message||"Erreur de connexion.");}
    finally{setLoading(false);}
  };
  return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0E0E0D',fontFamily:"'DM Sans',sans-serif",overflow:'hidden',position:'relative'}}>
    {/* Animated background shapes */}
    <div style={{position:'absolute',top:'-15%',right:'-10%',width:'600px',height:'600px',borderRadius:'50%',background:'radial-gradient(circle,rgba(232,80,26,.12) 0%,transparent 70%)',animation:'pulse1 8s ease-in-out infinite'}}/>
    <div style={{position:'absolute',bottom:'-20%',left:'-8%',width:'500px',height:'500px',borderRadius:'50%',background:'radial-gradient(circle,rgba(232,80,26,.08) 0%,transparent 70%)',animation:'pulse2 10s ease-in-out infinite'}}/>
    <div style={{position:'absolute',top:'40%',left:'30%',width:'300px',height:'300px',borderRadius:'50%',background:'radial-gradient(circle,rgba(232,80,26,.05) 0%,transparent 70%)',animation:'pulse1 12s ease-in-out infinite'}}/>
    <style>{`@keyframes pulse1{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.15);opacity:1}}@keyframes pulse2{0%,100%{transform:scale(1.1);opacity:.6}50%{transform:scale(.9);opacity:1}}@keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>

    {/* Centered login form */}
    <div style={{width:'100%',maxWidth:440,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 20px',position:'relative',zIndex:2}}>
      <div style={{width:'100%',maxWidth:400,animation:'fadeUp .6s ease'}}>
        {/* Logo centered */}
        <div style={{textAlign:'center',marginBottom:30}}>
          <div style={{width:56,height:56,borderRadius:15,background:'#E8501A',display:'inline-flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 30px rgba(232,80,26,.35)',marginBottom:12}}>
            <span style={{color:'#fff',fontWeight:800,fontSize:17}}>ECO</span>
          </div>
          <div style={{color:'#fff',fontSize:22,fontWeight:800,letterSpacing:'-.3px'}}>Eco-formalités</div>
          <div style={{color:'rgba(255,255,255,.4)',fontSize:12,fontWeight:500,marginTop:4}}>Plateforme de gestion CRM</div>
        </div>

        <div style={{background:'rgba(255,255,255,.04)',backdropFilter:'blur(20px)',border:'1px solid rgba(255,255,255,.08)',borderRadius:20,padding:'36px 30px',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
          <div style={{marginBottom:28}}>
            <h2 style={{color:'#fff',fontSize:22,fontWeight:800,marginBottom:6}}>Connexion</h2>
            <p style={{color:'rgba(255,255,255,.4)',fontSize:13}}>Accédez à votre espace de travail</p>
          </div>

          {err&&<div style={{background:'rgba(200,38,14,.12)',border:'1px solid rgba(200,38,14,.3)',borderRadius:10,padding:'10px 14px',color:'#ff6b5a',fontSize:13,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#ff6b5a" strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke="#ff6b5a" strokeWidth="2" strokeLinecap="round"/></svg>
            {err}
          </div>}

          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,.5)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Adresse email</label>
              <div style={{position:'relative'}}>
                <svg style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',opacity:.35}} width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="3" stroke="#fff" strokeWidth="1.8"/><path d="M2 7l10 6 10-6" stroke="#fff" strokeWidth="1.8"/></svg>
                <input type="email" value={em} onChange={e=>setEm(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="votre@email.fr"
                  style={{width:'100%',padding:'12px 14px 12px 40px',background:'rgba(255,255,255,.06)',border:'1.5px solid rgba(255,255,255,.1)',borderRadius:10,color:'#fff',fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:'none',transition:'.2s'}}
                  onFocus={e=>e.target.style.borderColor='#E8501A'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.1)'}/>
              </div>
            </div>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'rgba(255,255,255,.5)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Mot de passe</label>
              <div style={{position:'relative'}}>
                <svg style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',opacity:.35}} width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="#fff" strokeWidth="1.8"/><path d="M8 11V7a4 4 0 118 0v4" stroke="#fff" strokeWidth="1.8"/></svg>
                <input type={showPw?"text":"password"} value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="••••••••"
                  style={{width:'100%',padding:'12px 42px 12px 40px',background:'rgba(255,255,255,.06)',border:'1.5px solid rgba(255,255,255,.1)',borderRadius:10,color:'#fff',fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:'none',transition:'.2s'}}
                  onFocus={e=>e.target.style.borderColor='#E8501A'} onBlur={e=>e.target.style.borderColor='rgba(255,255,255,.1)'}/>
                <button onClick={()=>setShowPw(!showPw)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',padding:4,opacity:.4,color:'#fff'}} tabIndex={-1} type="button">
                  {showPw
                    ?<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="#fff" strokeWidth="1.8"/></svg>
                    :<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#fff" strokeWidth="1.8"/><circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth="1.8"/></svg>
                  }
                </button>
              </div>
            </div>
            <button onClick={go} disabled={loading}
              style={{width:'100%',padding:'13px 20px',background:loading?'#c43e10':'#E8501A',color:'#fff',border:'none',borderRadius:10,fontSize:14,fontWeight:700,cursor:loading?'wait':'pointer',fontFamily:"'DM Sans',sans-serif",display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginTop:4,transition:'background .2s',boxShadow:'0 4px 20px rgba(232,80,26,.35)'}}>
              {loading
                ?<><svg width="18" height="18" viewBox="0 0 24 24" style={{animation:'spin 1s linear infinite'}}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,.3)" strokeWidth="3" fill="none"/><path d="M12 2a10 10 0 019.8 8" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round"/></svg><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>Connexion en cours...</>
                :<>Se connecter<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></>
              }
            </button>
          </div>
        </div>

        <div style={{marginTop:20,padding:'14px 18px',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.06)',borderRadius:12,fontSize:12,color:'rgba(255,255,255,.35)',lineHeight:1.8}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,.4)" strokeWidth="1.5"/><path d="M12 8v4M12 16h.01" stroke="rgba(255,255,255,.4)" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <strong style={{color:'rgba(255,255,255,.55)'}}>Comptes démo</strong>
          </div>
          superadmin@crm.fr / admin2024<br/>admin@crm.fr / admin123
        </div>

        <p style={{textAlign:'center',marginTop:20,fontSize:11,color:'rgba(255,255,255,.2)'}}>© 2024 Eco-formalités — Tous droits réservés</p>
      </div>
    </div>
  </div>;
}

// ── AVANCEMENT COMPONENT ──
function Avancement({d,save,toast}){
  const av=d.avancement||{};
  const upd=(k,v)=>{const patch={avancement:{...av,[k]:v}};if(k==="dp_envoi")patch.date_envoi_dp=v;save(patch);};
  const steps=[
    {key:"dp",label:"Demande Prealable",sentKey:"dp_envoi",noteKey:"dp_note",color:"#6366f1"},
    {key:"racc",label:"Raccordement",sentKey:"racc_date",noteKey:"racc_note",color:"#E8501A"},
    {key:"cons",label:"CONSUEL",sentKey:"cons_date",noteKey:"cons_note",color:"#f59e0b"},
    {key:"tva",label:"Recuperation TVA",sentKey:"tva_date",noteKey:"tva_note",color:"#059669"},
  ];

  // Couleurs badges statut DP
  const dpStatusColor={
    "Récépissé reçu":{bg:"#ecfdf5",border:"#a7f3d0",tx:"#059669"},
    "Incomplet":{bg:"#fffbeb",border:"#fcd34d",tx:"#b45309"},
    "Réenvoi":{bg:"#fef2f2",border:"#fca5a5",tx:"#dc2626"},
  };
  // Couleurs badges statut CONSUEL
  const consStatusColor={
    "Positif":{bg:"#ecfdf5",border:"#a7f3d0",tx:"#059669"},
    "Envoyé au CONSUEL":{bg:"#EEF3FD",border:"#bfdbfe",tx:"#1A4A8A"},
    "À envoyer au CONSUEL":{bg:"#fffbeb",border:"#fcd34d",tx:"#b45309"},
    "Avis de visite":{bg:"#f5f3ff",border:"#c4b5fd",tx:"#7c3aed"},
  };
  // Couleurs badges statut Raccordement
  const raccStatusColor={
    "Mise en service":{bg:"#ecfdf5",border:"#a7f3d0",tx:"#059669"},
    "Mise en service programmée":{bg:"#EEF3FD",border:"#bfdbfe",tx:"#1A4A8A"},
    "Réenvoi":{bg:"#fef2f2",border:"#fca5a5",tx:"#dc2626"},
  };

  return <div>
    <div className="sec">Avancement du dossier</div>
    {steps.map(st=>{
      const checked=!!av[st.key+"_checked"];
      const date=av[st.sentKey]||"";
      const note=av[st.noteKey]||"";
      const isRacc=st.key==="racc";
      const isDP=st.key==="dp";
      const isCons=st.key==="cons";
      const dpSt=av.dp_status||"";
      const dpStColor=dpStatusColor[dpSt];
      const raccSt=av.racc_status||"";
      const raccStColor=raccStatusColor[raccSt];
      const consSt=av.cons_status||"";
      const consStColor=consStatusColor[consSt];
      const raccNeedsDate=RACC_STATUSES_WITH_DATE.includes(raccSt);
      return <div className="av-section" key={st.key}>
        <div className="av-head" style={{borderLeft:"4px solid "+st.color}}>
          <div className={"av-dot"+(checked?" done":"")} onClick={()=>upd(st.key+"_checked",!checked)}>
            {checked&&<Ic n="check" s={12} c="#fff"/>}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:checked?"var(--gr)":"var(--tx)"}}>{st.label}</div>
            {checked&&!isDP&&!isCons&&!isRacc&&<div style={{fontSize:10,color:"var(--gr)",marginTop:1}}>✓ Complete</div>}
            {isDP&&dpSt&&<div style={{fontSize:10,marginTop:1,color:dpStColor?.tx||"var(--tx3)",fontWeight:600}}>{dpSt}</div>}
            {isCons&&consSt&&<div style={{fontSize:10,marginTop:1,color:consStColor?.tx||"var(--tx3)",fontWeight:600}}>{consSt}</div>}
            {isRacc&&raccSt&&<div style={{fontSize:10,marginTop:1,color:raccStColor?.tx||"var(--or)",fontWeight:600}}>{raccSt}</div>}
          </div>
          {/* Dropdown statut DP */}
          {isDP&&<select value={dpSt} onChange={e=>upd("dp_status",e.target.value)}
            style={{width:"auto",fontSize:11,padding:"3px 7px",fontWeight:600,
              background:dpStColor?dpStColor.bg:"var(--bg2)",
              borderColor:dpStColor?dpStColor.border:"var(--bd)",
              color:dpStColor?dpStColor.tx:"var(--tx3)"}}>
            <option value="">-- Statut DP --</option>
            {DP_STATUSES.map(s=><option key={s}>{s}</option>)}
          </select>}
          {/* Dropdown statut CONSUEL */}
          {isCons&&<select value={consSt} onChange={e=>upd("cons_status",e.target.value)}
            style={{width:"auto",fontSize:11,padding:"3px 7px",fontWeight:600,
              background:consStColor?consStColor.bg:"var(--bg2)",
              borderColor:consStColor?consStColor.border:"var(--bd)",
              color:consStColor?consStColor.tx:"var(--tx3)"}}>
            <option value="">-- Statut CONSUEL --</option>
            {CONS_STATUSES.map(s=><option key={s}>{s}</option>)}
          </select>}
          {/* Dropdown statut Raccordement */}
          {isRacc&&<select value={raccSt} onChange={e=>upd("racc_status",e.target.value)}
            style={{width:"auto",fontSize:11,padding:"3px 7px",fontWeight:600,
              background:raccStColor?raccStColor.bg:av.racc_status?"var(--or-l)":"var(--bg2)",
              borderColor:raccStColor?raccStColor.border:av.racc_status?"var(--or)":"var(--bd)",
              color:raccStColor?raccStColor.tx:av.racc_status?"var(--or)":"var(--tx3)"}}>
            <option value="">-- Statut --</option>
            {RACC_STATUSES.map(rs=><option key={rs}>{rs}</option>)}
          </select>}
        </div>
        <div className="av-body">
          <div className="av-left">
            <div className="fg">
              <label className="lbl">{isDP?"Date de dépôt / envoi":"Date"}</label>
              <input type="date" value={date} onChange={e=>upd(st.sentKey,e.target.value)}/>
            </div>
            {/* Date du statut DP */}
            {isDP&&<div className="fg" style={{marginTop:8}}>
              <label className="lbl">Date du statut
                {dpSt&&<span style={{marginLeft:6,fontSize:10,fontWeight:700,color:dpStColor?.tx,background:dpStColor?.bg,padding:"1px 6px",borderRadius:8,border:`1px solid ${dpStColor?.border}`}}>{dpSt}</span>}
              </label>
              <input type="date" value={av.dp_status_date||""} onChange={e=>upd("dp_status_date",e.target.value)}/>
            </div>}
            {/* Date du statut Raccordement — uniquement pour les 3 statuts avec date */}
            {isRacc&&raccNeedsDate&&<div className="fg" style={{marginTop:8}}>
              <label className="lbl">Date — {raccSt}
                <span style={{marginLeft:6,fontSize:10,fontWeight:700,color:raccStColor?.tx,background:raccStColor?.bg,padding:"1px 6px",borderRadius:8,border:`1px solid ${raccStColor?.border}`}}>{raccSt}</span>
              </label>
              <input type="date" value={av.racc_status_date||""} onChange={e=>upd("racc_status_date",e.target.value)}/>
            </div>}
          </div>
          <div className="av-right">
            <div className="fg">
              <label className="lbl">Observations</label>
              <textarea value={note} onChange={e=>upd(st.noteKey,e.target.value)} style={{minHeight:60}} placeholder="Notes sur cette etape..."/>
            </div>
          </div>
        </div>
      </div>;
    })}
  </div>;
}

// ── DOCUMENT PREVIEW ──
function DocPreview({doc,onClose}){
  const ext=(doc.name||"").split(".").pop().toLowerCase();
  const isImg=["jpg","jpeg","png","gif","webp"].includes(ext);
  const isPdf=ext==="pdf";
  return <div className="pr-ov" onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="pr-box" style={{maxWidth:isPdf?"900px":"600px"}}>
      <div className="pr-hdr">
        <span style={{fontWeight:700,fontSize:13}}>{doc.name}</span>
        <button className="btn btn-s btn-sm" onClick={onClose}><Ic n="x" s={12}/>Fermer</button>
      </div>
      <div style={{padding:16,flex:1,display:"flex",alignItems:"center",justifyContent:"center",minHeight:300}}>
        {doc.url&&isImg&&<img src={doc.url} alt={doc.name} style={{maxWidth:"100%",maxHeight:"70vh",borderRadius:8}}/>}
        {doc.url&&isPdf&&<iframe src={doc.url} style={{width:"100%",height:"70vh",border:"none",borderRadius:8}} title={doc.name}/>}
        {!doc.url&&<div style={{textAlign:"center",color:"var(--tx3)"}}>
          <div style={{fontSize:48,marginBottom:12}}>📄</div>
          <div style={{fontSize:13,fontWeight:600}}>{doc.name}</div>
          <div style={{fontSize:11,color:"var(--tx4)",marginTop:4}}>{doc.size}</div>
          <div style={{fontSize:11,color:"var(--tx4)",marginTop:8}}>Apercu non disponible — telechargez le fichier</div>
        </div>}
      </div>
    </div>
  </div>;
}

// ── DOSSIER FORM ──
function DossierForm({initial,onSave,onClose,currentUser,clientsOrg,onAddOrg}){
  const isSA=currentUser.role==="superadmin";
  // Décompose client en prénom / nom pour l'édition
  const splitName=(full="")=>{const parts=(full||"").trim().split(/\s+/);return {prenom:parts[0]||"",nom:parts.slice(1).join(" ")||""};};
  const blank={client:"",client_prenom:"",client_nom:"",client_org:"",email:"",phone:"",address:"",ville:"",postal_code:"",dp_number:"",parcelle:"",
    date_envoi_dp:"",mairie_email:"",siret:"",company_name:"",representant:"",kbis_address:"",urbanisme_result:null,
    works:[{type:"PAC",formalites:["Demande Prealable"],kwc:"",kwc_c:""}],
    status:"en_attente",assignee:"",paid:false,amount:0,installed:false,
    docs:[],comments:[],avancement:{dp_checked:false,dp_envoi:"",dp_note:"",racc_checked:false,racc_date:"",racc_status:"",racc_note:"",cons_checked:false,cons_date:"",cons_note:"",tva_checked:false,tva_date:"",tva_note:""}
  };
  const initForm=initial
    ?{...initial,...splitName(initial.client),works:(initial.works||[]).map(w=>({...w}))}
    :blank;
  const [f,setF]=useState(initForm);
  const [sc,setSc]=useState(false);const [dpR,setDpR]=useState(null);
  const [cdSc,setCdSc]=useState(false);const [cdR,setCdR]=useState(null);
  const [iCmt,setICmt]=useState("");const [newOrg,setNewOrg]=useState("");const [showOrg,setShowOrg]=useState(false);
  const pRef=useRef();const cdRef=useRef();
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const setW=(i,k,v)=>{const w=[...f.works];w[i]={...w[i],[k]:v};set("works",w);};
  const togFmt=(i,fm)=>{const w=[...f.works];const cur=w[i].formalites||[];w[i]={...w[i],formalites:cur.includes(fm)?cur.filter(x=>x!==fm):[...cur,fm]};set("works",w);};
  const needKwc=t=>["Panneaux Solaires","Systeme Solaire Combine"].includes(t);
  const scanPdf=async(file)=>{setSc(file.type?.startsWith("image/")?"ocr":true);setDpR(null);const dp=await extractDP(file);setSc(false);if(dp){setDpR(dp);set("dp_number",dp);}else setDpR("none");};
  const scanClientDoc=async(file)=>{
    const isPdf=file.type?.includes("pdf");const isImg=file.type?.startsWith("image/");
    if(!isPdf&&!isImg)return setCdR({error:"Formats acceptés : PDF, JPG, PNG"});
    setCdSc(isImg?"ocr":true);setCdR(null);
    const res=await extractClientData(file);
    setCdSc(false);
    if(res&&(res.nom||res.prenom||res.email||res.phone||res.address||res.organisme)){
      setCdR(res);
      if(res.nom)set("client_nom",res.nom);
      if(res.prenom)set("client_prenom",res.prenom);
      if(res.email)set("email",res.email);
      if(res.phone)set("phone",res.phone);
      if(res.address)set("address",res.address);
      if(res.organisme&&!f.client_org)set("client_org",res.organisme);
    }else{setCdR({error:"Aucune donnée client trouvée dans ce document"});}
  };
  const save=()=>{
    const fullName=`${f.client_prenom||""} ${f.client_nom||""}`.trim()||f.client||"";
    if(!fullName)return;
    const now=new Date().toISOString().split("T")[0];
    const fallback=initial?.id||genId();
    const id=dossierId(f.dp_number,fallback);
    const cmts=[...(f.comments||[])];
    if(iCmt.trim())cmts.push({author:currentUser.name,date:now,text:iCmt,from_client:false});
    onSave({...f,client:fullName,id,_oldId:initial?.id||fallback,created:initial?.created||now,updated:now,comments:cmts});
  };
  return <div className="ov" onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="modal">
      <div className="mhdr">
        <div><h2 style={{fontSize:16,fontWeight:800}}>{initial?"Modifier":"Nouveau dossier"}</h2>{initial&&<div style={{fontSize:10,color:"var(--or)",marginTop:2}}>{initial.id}</div>}</div>
        <button className="bic" onClick={onClose}><Ic n="x"/></button>
      </div>
      <div className="mbdy">
        {/* Layout: left form, right comments */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:20}}>
          <div>
            {/* Statut + Responsable en haut */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              <div className="fg">
                <label className="lbl">Statut du dossier</label>
                <select value={f.status} onChange={e=>set("status",e.target.value)}>{ALL_STATUSES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select>
                <div style={{marginTop:4}}><SBadge status={f.status}/></div>
              </div>
              <div className="fg"><label className="lbl">Responsable</label><select value={f.assignee} onChange={e=>set("assignee",e.target.value)}><option value="">-- Non attribué --</option>{EMPLOYEES.map(e=><option key={e}>{e}</option>)}</select></div>
            </div>
            {/* Scanner DP */}
            <div className="fg" style={{marginBottom:16}}>
              <label className="lbl">N° DP — Scanner document (PDF, JPG, PNG)</label>
              <div style={{display:"flex",gap:7}}>
                <input value={f.dp_number} onChange={e=>set("dp_number",e.target.value)} placeholder="DP 075 111 24 00001" style={{flex:1}}/>
                <button className="btn btn-s btn-sm" onClick={()=>pRef.current&&pRef.current.click()}><Ic n="scan" s={12}/>Scanner</button>
              </div>
              <input ref={pRef} type="file" accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])scanPdf(e.target.files[0]);e.target.value="";}}/>
              {sc&&<div style={{display:"flex",gap:6,fontSize:12,color:"var(--tx3)",padding:"4px 0"}}><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span>{sc==="ocr"?"OCR en cours sur image...":"Lecture document..."}</div>}
              {dpR&&dpR!=="none"&&<div style={{background:"var(--gr-l)",border:"1px solid #a7f3d0",borderRadius:"var(--r)",padding:"8px 12px",display:"flex",gap:8,marginTop:5}}><Ic n="check" s={13} c="var(--gr)"/><div><div style={{fontSize:10,fontWeight:700,color:"var(--gr)"}}>N° DP detecte</div><div style={{fontSize:12}}>{dpR}</div></div></div>}
              {dpR==="none"&&<div style={{background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:"var(--r)",padding:"7px 10px",fontSize:11,color:"#b45309",marginTop:5}}>Aucun N° DP trouve. Saisir manuellement.</div>}
            </div>
            {/* Extraction données client */}
            <div style={{background:"var(--or-l)",border:"1.5px solid rgba(232,80,26,.25)",borderRadius:"var(--rl)",padding:14,marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:800,color:"var(--or)",marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>Extraction données client — Pré-remplissage automatique</div>
              <div
                onDrop={e=>{e.preventDefault();if(e.dataTransfer.files?.[0])scanClientDoc(e.dataTransfer.files[0]);}}
                onDragOver={e=>e.preventDefault()}
                onClick={()=>!cdSc&&cdRef.current?.click()}
                style={{border:"2px dashed rgba(232,80,26,.3)",borderRadius:"var(--r)",padding:"18px 12px",textAlign:"center",cursor:cdSc?"not-allowed":"pointer",background:cdSc?"#fef6f2":"#fff",transition:"all .15s"}}
              >
                <input ref={cdRef} type="file" accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])scanClientDoc(e.target.files[0]);e.target.value="";}}/>
                {cdSc?<div style={{display:"flex",gap:6,justifyContent:"center",fontSize:12,color:"var(--tx3)"}}><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span>{cdSc==="ocr"?"OCR en cours sur image...":"Analyse du document..."}</div>
                :<div><div style={{fontSize:13,fontWeight:600,color:"var(--or)"}}>Glisser un document ici (PDF, JPG, PNG)</div><div style={{fontSize:11,color:"#6B6B60",marginTop:3}}>Nom, prénom, organisme, adresse, téléphone et email extraits automatiquement</div></div>}
              </div>
              {cdR&&!cdR.error&&<div style={{background:"#ecfdf5",border:"1px solid #a7f3d0",borderRadius:"var(--r)",padding:"10px 12px",marginTop:8}}>
                <div style={{fontSize:11,fontWeight:700,color:"#059669",marginBottom:4}}>Données client extraites avec succès</div>
                {cdR.nom&&<div style={{fontSize:11}}><span style={{color:"#6B6B60"}}>Nom : </span><strong>{cdR.nom}</strong></div>}
                {cdR.prenom&&<div style={{fontSize:11}}><span style={{color:"#6B6B60"}}>Prénom : </span><strong>{cdR.prenom}</strong></div>}
                {cdR.organisme&&<div style={{fontSize:11}}><span style={{color:"#6B6B60"}}>Organisme : </span><strong>{cdR.organisme}</strong></div>}
                {cdR.address&&<div style={{fontSize:11}}><span style={{color:"#6B6B60"}}>Adresse : </span><strong>{cdR.address}</strong></div>}
                {cdR.phone&&<div style={{fontSize:11}}><span style={{color:"#6B6B60"}}>Téléphone : </span><strong>{cdR.phone}</strong></div>}
                {cdR.email&&<div style={{fontSize:11}}><span style={{color:"#6B6B60"}}>Email : </span><strong>{cdR.email}</strong></div>}
              </div>}
              {cdR?.error&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:"var(--r)",padding:"7px 10px",fontSize:11,color:"#b91c1c",marginTop:8}}>{cdR.error}</div>}
            </div>
            {/* Client info */}
            <div className="sec" style={{marginBottom:12}}>Informations client</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              <div className="fg"><label className="lbl">Nom *</label><input value={f.client_nom||""} onChange={e=>set("client_nom",e.target.value)} placeholder="Nom de famille"/></div>
              <div className="fg"><label className="lbl">Prénom *</label><input value={f.client_prenom||""} onChange={e=>set("client_prenom",e.target.value)} placeholder="Prénom"/></div>
              <div className="fg">
                <label className="lbl">Organisme</label>
                <div style={{display:"flex",gap:5}}>
                  <select value={f.client_org} onChange={e=>set("client_org",e.target.value)} style={{flex:1}}><option value="">-- Aucun --</option>{clientsOrg.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select>
                  <button className="btn btn-s btn-sm" onClick={()=>setShowOrg(v=>!v)}><Ic n="plus" s={11}/></button>
                </div>
                {showOrg&&<div style={{display:"flex",gap:5,marginTop:5}}><input value={newOrg} onChange={e=>setNewOrg(e.target.value)} placeholder="Nom organisme..."/><button className="btn btn-p btn-sm" onClick={()=>{if(newOrg.trim()){onAddOrg(newOrg.trim());set("client_org",newOrg.trim());setNewOrg("");setShowOrg(false);}}}><Ic n="check" s={11}/></button></div>}
              </div>
              <div className="fg"><label className="lbl">Email</label><input type="email" value={f.email} onChange={e=>set("email",e.target.value)}/></div>
              <div className="fg"><label className="lbl">Telephone</label><input value={f.phone} onChange={e=>set("phone",e.target.value)}/></div>
              <div className="fg" style={{gridColumn:"1/-1"}}><label className="lbl">Adresse</label><input value={f.address} onChange={e=>set("address",e.target.value)}/></div>
              <div className="fg"><label className="lbl">Ville</label><input value={f.ville||""} onChange={e=>set("ville",e.target.value)} placeholder="Ex: Marseille"/></div>
              <div className="fg"><label className="lbl">Code postal</label><input value={f.postal_code||""} onChange={e=>set("postal_code",e.target.value)} placeholder="Ex: 13001"/></div>
              <div className="fg"><label className="lbl">Parcelle cadastrale</label><input value={f.parcelle} onChange={e=>set("parcelle",e.target.value)} placeholder="Ex: AB 0012"/></div>
            </div>
            {/* Travaux — single type only */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <span className="sec" style={{margin:0,padding:0,border:"none"}}>Travaux</span>
            </div>
            {f.works.map((w,i)=><div key={i} style={{background:"var(--bg3)",border:"1.5px solid var(--bd)",borderRadius:"var(--r)",padding:13,marginBottom:10}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:10}}>
                <div className="fg"><label className="lbl-h">Type de travaux</label><select value={w.type} onChange={e=>setW(i,"type",e.target.value)}>{WORK_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                {f.works.length>1&&<button className="bic" style={{marginTop:24,alignSelf:"flex-start"}} onClick={()=>set("works",f.works.filter((_,j)=>j!==i))}><Ic n="x" s={12}/></button>}
              </div>
              {needKwc(w.type)&&<div className="fg" style={{marginBottom:10}}><label className="lbl">Puissance kWc</label><select value={w.kwc||""} onChange={e=>setW(i,"kwc",e.target.value)}><option value="">-- Choisir --</option>{KWC_OPTIONS.map(k=><option key={k}>{k}</option>)}</select>{w.kwc==="Personnalise"&&<input style={{marginTop:5}} value={w.kwc_c||""} onChange={e=>setW(i,"kwc_c",e.target.value)} placeholder="Ex: 10.5 kwc"/>}</div>}
              <div>
                <label className="lbl-h">Types de formalites</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {FORMALITES.map(fm=><button key={fm} className={"fmt-btn"+((w.formalites||[]).includes(fm)?" sel":"")} onClick={()=>togFmt(i,fm)}>{fm}</button>)}
                </div>
              </div>
            </div>)}
            <button className="btn btn-s btn-sm" onClick={()=>set("works",[...f.works,{type:"ITE",formalites:[],kwc:"",kwc_c:""}])}><Ic n="plus" s={11}/>Ajouter type travaux</button>
            {/* Options bas */}
            <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center",marginTop:14,padding:"11px 14px",background:"var(--bg3)",borderRadius:"var(--r)",border:"1.5px solid var(--bd)"}}>
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,fontWeight:500}}><input type="checkbox" checked={f.installed} onChange={e=>set("installed",e.target.checked)}/>Client installe</label>
              {isSA&&<label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,fontWeight:500}}><input type="checkbox" checked={f.paid} onChange={e=>set("paid",e.target.checked)}/>Paye</label>}
              {isSA&&<div className="fg" style={{flexDirection:"row",alignItems:"center",gap:7}}><label className="lbl" style={{whiteSpace:"nowrap"}}>Montant €</label><input type="number" value={f.amount} onChange={e=>set("amount",Number(e.target.value))} style={{width:90}}/></div>}
            </div>
          </div>
          {/* RIGHT: comments */}
          <div style={{borderLeft:"1.5px solid var(--bd)",paddingLeft:20}}>
            <div className="sec">Commentaire initial</div>
            <textarea value={iCmt} onChange={e=>setICmt(e.target.value)} placeholder="Ajouter un commentaire..." style={{minHeight:120}}/>
            <div style={{fontSize:11,color:"var(--tx4)",marginTop:6}}>Ce commentaire sera envoye par email au client.</div>
          </div>
        </div>
      </div>
      <div className="mftr"><button className="btn btn-s" onClick={onClose}>Annuler</button><button className="btn btn-p" onClick={save}><Ic n="check" s={13}/>{initial?"Enregistrer":"Creer le dossier"}</button></div>
    </div>
  </div>;
}

// ── DOSSIER DETAIL ──
function DossierDetail({dossier,onClose,onUpdate,currentUser,addNotif,toast}){
  const isSA=currentUser.role==="superadmin";
  const [tab,setTab]=useState("info");
  const [d,setD]=useState({...dossier});
  const [editing,setEditing]=useState(false);
  const [cmt,setCmt]=useState("");
  const [previewDoc,setPreviewDoc]=useState(null);
  const [assignConfirm,setAssignConfirm]=useState(false);
  // Scanner DP dans l'onglet Documents
  const [dpScanning,setDpScanning]=useState(false);
  const [dpScanResult,setDpScanResult]=useState(null);
  const dpScanRef=useRef();
  // Urbanisme AI lookup
  const [urbLoading,setUrbLoading]=useState(false);
  const [urbError,setUrbError]=useState(null);
  const fRef=useRef();
  const save=u=>{
    const nd={...d,...u,updated:new Date().toISOString().split("T")[0]};
    // Si le DP change, mettre à jour l'ID du dossier
    if(u.dp_number){const oldId=nd.id;nd.id=dossierId(u.dp_number,oldId);nd._oldId=oldId;}
    setD(nd);onUpdate(nd);
  };
  const scanDpFromDoc=async(file)=>{
    setDpScanning(file.type?.startsWith("image/")?"ocr":true);setDpScanResult(null);
    const dp=await extractDP(file);
    setDpScanning(false);
    if(dp){setDpScanResult(dp);save({dp_number:dp});toast("N° DP extrait et enregistré : "+dp,"s");}
    else setDpScanResult("none");
  };

  const doUrbanismeLookup=async()=>{
    const ville=d.ville;
    if(!ville){toast("Renseignez d'abord la ville du dossier","w");return;}
    setUrbLoading(true);setUrbError(null);
    try{
      const result=await lookupUrbanisme(ville,d.postal_code);
      save({urbanisme_result:result});
      if(result.email_urbanisme&&!d.mairie_email){save({mairie_email:result.email_urbanisme});}
      toast("Recherche urbanisme terminée pour "+ville,"s");
    }catch(err){setUrbError(err.message||"Erreur lors de la recherche");}
    finally{setUrbLoading(false);}
  };

  // Résoudre l'email mairie : champ dédié → scan commentaires
  const resolveMairieEmail=(dossier)=>{
    if(dossier.mairie_email) return {email:dossier.mairie_email,source:"champ dédié"};
    const re=/[\w.+%-]+@[\w-]+\.[a-z]{2,}/i;
    for(const c of (dossier.comments||[])){
      const m=(c.text||"").match(re);
      if(m) return {email:m[0],source:`commentaire du ${c.date} (${c.author})`};
    }
    return null;
  };
  const mairieResolved=resolveMairieEmail(d);

  const doSelfAssign=()=>{
    save({assignee:currentUser.name,assign_by:currentUser.name,assign_at:new Date().toISOString()});
    toast(currentUser.name+" s'est attribué ce dossier","s");
    addNotif({type:"assign",msg:"Dossier "+d.client+" attribué à "+currentUser.name,dossier_id:d.id,date:new Date().toISOString()});
    setAssignConfirm(false);
  };
  const isAssignedToMe=d.assignee===currentUser.name;
  const isUnassigned=!d.assignee;
  const handleSelfAssign=()=>{
    if(isAssignedToMe)return;
    if(!isUnassigned){setAssignConfirm(true);}else{doSelfAssign();}
  };
  const addCmt=()=>{
    if(!cmt.trim())return;
    const nc={author:currentUser.name,date:new Date().toISOString().split("T")[0],text:cmt,from_client:false};
    save({comments:[...(d.comments||[]),nc]});
    setCmt("");
    toast("Email envoye a "+d.client+" (simulation)","i");
    addNotif({type:"comment",msg:"Nouveau commentaire sur dossier "+d.client,dossier_id:d.id,date:new Date().toISOString()});
  };
  const handleDocs=files=>{
    const nd=Array.from(files).map(f=>({name:f.name,size:Math.round(f.size/1024)+" KB",date:new Date().toISOString().split("T")[0],url:f.type.startsWith("image/")||f.type==="application/pdf"?URL.createObjectURL(f):null}));
    save({docs:[...(d.docs||[]),...nd]});
    toast(nd.length+" fichier(s) ajoute(s)","s");
    addNotif({type:"doc",msg:nd.length+" doc(s) ajoute(s) — "+d.client,dossier_id:d.id,date:new Date().toISOString()});
  };
  const tabs=["info","documents","avancement","commentaires",...(isSA?["paiement"]:[])];
  const tabLabel={info:"Informations",avancement:"Avancement",documents:"Documents",commentaires:"Commentaires",paiement:"Paiement"};
  return <div className="ov" onClick={e=>e.target===e.currentTarget&&onClose()}>
    {previewDoc&&<DocPreview doc={previewDoc} onClose={()=>setPreviewDoc(null)}/>}
    {/* Popup confirmation attribution */}
    {assignConfirm&&<div className="ov" style={{zIndex:10001}} onClick={()=>setAssignConfirm(false)}>
      <div style={{background:"var(--bg2)",borderRadius:"var(--rl)",padding:28,maxWidth:400,width:"90%",boxShadow:"var(--shl)",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:28,marginBottom:12}}>⚠️</div>
        <div style={{fontWeight:800,fontSize:15,marginBottom:8}}>Dossier déjà attribué</div>
        <div style={{fontSize:13,color:"var(--tx3)",marginBottom:20}}>Ce dossier est actuellement attribué à <strong>{d.assignee}</strong>.<br/>Voulez-vous vous l'attribuer quand même ?</div>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <button className="btn btn-p" onClick={doSelfAssign}>Oui, me l'attribuer</button>
          <button className="btn btn-s" onClick={()=>setAssignConfirm(false)}>Annuler</button>
        </div>
      </div>
    </div>}
    <div className="modal">
      <div className="mhdr">
        <div>
          <div style={{fontSize:10,color:"var(--or)",fontWeight:800,marginBottom:3}}>{d.id} <span className="ago" style={{fontWeight:500}}>• modifié il y a {timeAgo(d.updated)}</span></div>
          <h2 style={{fontSize:18,fontWeight:800}}>{d.client}</h2>
          <div style={{fontSize:13,color:"var(--tx3)",marginTop:1}}>{d.address}</div>
        </div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"flex-start"}}>
          <SBadge status={d.status}/>
          {d.installed&&<span style={{background:"#d1fae5",color:"#065f46",border:"1.5px solid #6ee7b7",padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:700}}>✓ Installe</span>}
          {/* Bouton S'attribuer */}
          {!isAssignedToMe&&<button className="btn btn-sm"
            style={{background:isUnassigned?"#ecfdf5":"#fffbeb",border:"1.5px solid "+(isUnassigned?"#a7f3d0":"#fcd34d"),color:isUnassigned?"#059669":"#b45309",fontWeight:700}}
            onClick={handleSelfAssign}>
            {isUnassigned?"☝ S'attribuer":"☝ Me l'attribuer"}
          </button>}
          {isAssignedToMe&&<span style={{background:"#ecfdf5",border:"1.5px solid #a7f3d0",color:"#059669",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>✓ Mon dossier</span>}
          <button className="btn btn-s btn-sm" onClick={()=>setEditing(true)}><Ic n="edit" s={11}/>Modifier</button>
          <button className="btn btn-s btn-sm" onClick={()=>openChatForDossier(d)} title="Ouvrir le chat pour ce dossier"><Ic n="msg" s={11}/>Chat</button>
          <button className="bic" onClick={onClose}><Ic n="x"/></button>
        </div>
      </div>
      <div style={{padding:"0 24px",borderBottom:"1.5px solid var(--bd)"}}>
        <div className="tabs" style={{borderBottom:"none"}}>
          {tabs.map(t=><button key={t} className={"tab"+(tab===t?" act":"")} onClick={()=>setTab(t)}>{tabLabel[t]}</button>)}
        </div>
      </div>
      <div className="mbdy">

        {tab==="info"&&<div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
            {d.assignee
              ?<span className="asgn"><span className="av-ico">{d.assignee[0]}</span>{d.assignee}</span>
              :<span style={{fontSize:12,color:"var(--tx4)",fontStyle:"italic",padding:"4px 10px",border:"1.5px dashed var(--bd2)",borderRadius:20}}>Non attribué</span>
            }
            {d.client_org&&<span className="chip" style={{background:"var(--or-l)",color:"var(--or)",border:"1px solid rgba(232,80,26,.2)"}}>{d.client_org}</span>}
          </div>
          {/* Statut visible */}
          <div style={{marginBottom:14,padding:"10px 14px",background:"var(--bg3)",borderRadius:"var(--r)",border:"1.5px solid var(--bd)",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:10,fontWeight:700,color:"var(--tx4)",textTransform:"uppercase",letterSpacing:".08em"}}>Statut</span>
            <SBadge status={d.status}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            <div>
              {[["Email",d.email],["Telephone",d.phone],["Adresse",d.address,true],["Ville",d.ville],["Code postal",d.postal_code],["N° DP",d.dp_number],["Parcelle",d.parcelle]].map(([l,v,full])=><div key={l} style={{marginBottom:12,...(full?{gridColumn:"1/-1"}:{})}}>
                <div style={{fontSize:9,fontWeight:700,color:"var(--tx4)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:3}}>{l}</div>
                <div style={{fontSize:13,fontWeight:500,fontFamily:"var(--ff)"}}>{v||"—"}</div>
              </div>)}
              {/* Bloc relances automatiques */}
              {(d.date_envoi_dp||d.mairie_email)&&<div style={{background:"var(--or-l)",border:"1.5px solid rgba(232,80,26,.25)",borderRadius:"var(--r)",padding:"10px 12px",marginTop:4}}>
                <div style={{fontSize:9,fontWeight:800,color:"var(--or)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>⏰ Relances auto</div>
                {d.mairie_email&&<div style={{fontSize:11,color:"#374151",marginBottom:3}}><span style={{color:"#6B6B60"}}>Mairie : </span><strong>{d.mairie_email}</strong></div>}
                {d.date_envoi_dp&&(()=>{
                  const sent=new Date(d.date_envoi_dp);
                  const j6=new Date(sent);j6.setDate(j6.getDate()+6);
                  const j30=new Date(sent);j30.setDate(j30.getDate()+30);
                  const today=new Date();
                  return <>
                    <div style={{fontSize:11,marginBottom:2}}>
                      <span style={{color:"#6B6B60"}}>Envoi dossier : </span>
                      <strong>{sent.toLocaleDateString("fr-FR")}</strong>
                    </div>
                    <div style={{fontSize:11,marginBottom:2,color:d.relance_recepisee_at?"#059669":"var(--or)"}}>
                      {d.relance_recepisee_at?"✅":"📧"} Relance récépissé (J+6) : <strong>{j6.toLocaleDateString("fr-FR")}</strong>
                      {d.relance_recepisee_at&&<span style={{color:"#059669",marginLeft:5,fontSize:10}}>envoyée</span>}
                      {!d.relance_recepisee_at&&j6<=today&&<span style={{color:"#dc2626",marginLeft:5,fontSize:10,fontWeight:700}}>EN ATTENTE</span>}
                    </div>
                    <div style={{fontSize:11,color:d.relance_accord_dp_at?"#059669":"var(--or)"}}>
                      {d.relance_accord_dp_at?"✅":"📧"} Relance accord DP (J+30) : <strong>{j30.toLocaleDateString("fr-FR")}</strong>
                      {d.relance_accord_dp_at&&<span style={{color:"#059669",marginLeft:5,fontSize:10}}>envoyée</span>}
                      {!d.relance_accord_dp_at&&j30<=today&&<span style={{color:"#dc2626",marginLeft:5,fontSize:10,fontWeight:700}}>EN ATTENTE</span>}
                    </div>
                  </>;
                })()}
              </div>}
            </div>
            <div>
              <div style={{fontSize:9,fontWeight:700,color:"var(--tx4)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>Travaux</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:14}}>
                {(d.works||[]).map((w,i)=><div key={i} style={{padding:"8px 11px",background:"var(--bg3)",border:"1.5px solid var(--bd)",borderRadius:"var(--r)"}}>
                  <WChip type={w.type}/>
                  {w.kwc&&<span style={{marginLeft:5,fontSize:11,color:"var(--tx3)"}}>{w.kwc}</span>}
                  <div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:5}}>
                    {(w.formalites||[]).map(fm=><span key={fm} style={{background:"var(--bg2)",border:"1.5px solid var(--bd)",borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:600,color:"var(--tx3)"}}>{fm}</span>)}
                  </div>
                </div>)}
              </div>
              {isSA&&<div><div style={{fontSize:9,fontWeight:700,color:"var(--tx4)",textTransform:"uppercase",marginBottom:4}}>Montant</div><div style={{fontWeight:800,fontSize:24,color:d.paid?"var(--gr)":"var(--or)"}}>{(d.amount||0).toLocaleString("fr-FR")} €</div></div>}
            </div>
          </div>
        </div>}

        {tab==="avancement"&&<Avancement d={d} save={save} toast={toast}/>}

        {tab==="documents"&&<div>
          {/* Scanner récépissé de dépôt */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,padding:"8px 12px",background:"var(--bg3)",borderRadius:"var(--r)",border:"1.5px solid var(--bd)"}}>
            <div style={{flex:1,fontSize:12,color:"var(--tx3)"}}>
              {d.dp_number?<span>N° DP : <strong style={{color:"var(--or)"}}>{d.dp_number}</strong></span>:<span style={{fontStyle:"italic"}}>Aucun N° DP</span>}
            </div>
            <button className="btn btn-s btn-sm" style={{fontSize:10,padding:"4px 9px",gap:4}} onClick={()=>dpScanRef.current?.click()} disabled={!!dpScanning}>
              <Ic n="scan" s={10}/>{dpScanning?"Scan...":"Récépissé de dépôt"}
            </button>
            <input ref={dpScanRef} type="file" accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" style={{display:"none"}}
              onChange={e=>{if(e.target.files?.[0])scanDpFromDoc(e.target.files[0]);e.target.value="";}}/>
          </div>
          {dpScanning&&<div style={{display:"flex",gap:6,fontSize:11,color:"var(--tx4)",padding:"0 0 8px"}}><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span>{dpScanning==="ocr"?"OCR en cours...":"Lecture..."}</div>}
          {dpScanResult&&dpScanResult!=="none"&&<div style={{background:"var(--gr-l)",border:"1px solid #a7f3d0",borderRadius:"var(--r)",padding:"6px 10px",display:"flex",gap:6,marginBottom:10,fontSize:11}}>
            <Ic n="check" s={11} c="var(--gr)"/><span><strong style={{color:"var(--gr)"}}>N° DP détecté</strong> — {dpScanResult}</span>
          </div>}
          {dpScanResult==="none"&&<div style={{background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:"var(--r)",padding:"5px 10px",fontSize:11,color:"#b45309",marginBottom:10}}>Aucun N° DP trouvé.</div>}
          <GEDModule
            dossierId={d.id}
            dossierData={d}
            onDossierUpdate={(id,extracted)=>{
              if(extracted.dp_number){
                save({dp_number:extracted.dp_number});
                toast("N° DP extrait et enregistré : "+extracted.dp_number,"s");
              }
            }}
          />
        </div>}

        {tab==="commentaires"&&<div style={{display:"grid",gridTemplateColumns:"1fr 310px",gap:20}}>
          {/* ── Colonne gauche : commentaires ── */}
          <div>
            <div className="sec">Ajouter un commentaire</div>
            <div style={{display:"flex",gap:8,marginBottom:18}}>
              <textarea value={cmt} onChange={e=>setCmt(e.target.value)} placeholder="Message envoye par email au client..." style={{flex:1,minHeight:70}}/>
              <button className="btn btn-p btn-sm" style={{alignSelf:"flex-end"}} onClick={addCmt}><Ic n="msg" s={12}/>Envoyer</button>
            </div>
            <div className="sec">Historique</div>
            {[...(d.comments||[])].reverse().map((c,i)=><div key={i} className={"cmt"+(c.from_client?" cli":"")}>
              <div style={{fontSize:10,color:"var(--tx4)",marginBottom:4,display:"flex",gap:7,alignItems:"center"}}>
                <strong style={{color:c.from_client?"var(--gr)":"var(--or)"}}>{c.author}</strong>
                <span>{c.date}</span>
                {c.from_client&&<span style={{background:"var(--gr-l)",color:"var(--gr)",fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:3}}>CLIENT</span>}
              </div>
              <div style={{fontSize:12,lineHeight:1.6}}>{c.text}</div>
            </div>)}
            {!(d.comments||[]).length&&<p style={{color:"var(--tx4)",fontSize:12,textAlign:"center",padding:18}}>Aucun commentaire</p>}
          </div>

          {/* ── Colonne droite : Contact mairie + Urbanisme AI ── */}
          <div>
            {/* ── Recherche urbanisme — Annuaire Service Public ── */}
            <div style={{background:"linear-gradient(135deg,#ede9fe,#e0e7ff)",border:"1.5px solid rgba(99,102,241,.3)",borderRadius:"var(--rl)",padding:14,marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:800,color:"#6366f1",textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>🏛 Recherche urbanisme</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 90px",gap:6,marginBottom:8}}>
                <div className="fg">
                  <label className="lbl">Ville du dossier</label>
                  <input value={d.ville||""} onChange={e=>save({ville:e.target.value})} placeholder="Ex: Salon-de-Provence" style={{fontSize:12}}/>
                </div>
                <div className="fg">
                  <label className="lbl">Code postal</label>
                  <input value={d.postal_code||""} onChange={e=>save({postal_code:e.target.value})} placeholder="13300" style={{fontSize:12}}/>
                </div>
              </div>
              <button className="btn btn-sm" disabled={urbLoading||!d.ville}
                style={{background:"#6366f1",color:"#fff",border:"none",opacity:(urbLoading||!d.ville)?.5:1,width:"100%",justifyContent:"center",fontWeight:700}}
                onClick={doUrbanismeLookup}>
                {urbLoading?<><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span> Recherche en cours...</>:<>🔍 Rechercher mairie + communauté de communes</>}
              </button>
              {urbError&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:"var(--r)",padding:"6px 10px",fontSize:11,color:"#b91c1c",marginTop:8}}>{urbError}</div>}

              {/* Résultat annuaire + Google */}
              {d.urbanisme_result&&<div style={{marginTop:10}}>

                {/* ── Plateforme d'urbanisme (scan GNAU) ── */}
                {d.urbanisme_result.plateforme_urbanisme&&d.urbanisme_result.plateforme_urbanisme.length>0&&<div style={{background:"#fefce8",border:"1.5px solid #fde047",borderRadius:"var(--r)",padding:10,marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div style={{fontSize:9,fontWeight:700,color:"#a16207",textTransform:"uppercase"}}>🌐 Plateforme d'urbanisme trouvée</div>
                    {d.urbanisme_result.gnau_source&&<span style={{fontSize:8,fontWeight:700,padding:"1px 5px",borderRadius:3,background:d.urbanisme_result.gnau_source==="ville"?"#dcfce7":"#e0e7ff",color:d.urbanisme_result.gnau_source==="ville"?"#059669":"#6366f1"}}>
                      via {d.urbanisme_result.gnau_source}{d.urbanisme_result.gnau_interco?` (${d.urbanisme_result.gnau_interco})`:""}
                    </span>}
                  </div>
                  {d.urbanisme_result.plateforme_urbanisme.map((p,i)=><div key={i} style={{marginBottom:i<d.urbanisme_result.plateforme_urbanisme.length-1?8:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
                      <span style={{background:"#a16207",color:"#fff",fontSize:8,fontWeight:800,padding:"1px 5px",borderRadius:3}}>{p.type||"Lien"}</span>
                      {i===0&&<span style={{fontSize:8,color:"#059669",fontWeight:700}}>VÉRIFIÉ EN LIGNE</span>}
                    </div>
                    <a href={p.lien} target="_blank" rel="noopener noreferrer"
                      style={{fontSize:12,fontWeight:700,color:"#a16207",wordBreak:"break-all",textDecoration:"underline",display:"block"}}>{p.lien}</a>
                  </div>)}
                </div>}

                {d.urbanisme_result.plateforme_urbanisme&&d.urbanisme_result.plateforme_urbanisme.length===0&&<div style={{background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:"var(--r)",padding:"6px 10px",fontSize:11,color:"#b45309",marginBottom:8}}>
                  Aucune plateforme d'urbanisme (GNAU/SVE/Geosphere...) détectée pour cette ville.
                </div>}

                {/* ── Mairie (fusionnée service-public.fr + Google Places) ── */}
                {d.urbanisme_result.mairie&&<div style={{background:"#fff",border:"1.5px solid rgba(99,102,241,.2)",borderRadius:"var(--r)",padding:10,marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <div style={{fontSize:9,fontWeight:700,color:"#6366f1",textTransform:"uppercase"}}>{d.urbanisme_result.mairie.nom||"Mairie"}</div>
                    {d.urbanisme_result.mairie.sources&&<div style={{display:"flex",gap:3}}>
                      {d.urbanisme_result.mairie.sources.map((s,i)=><span key={i} style={{fontSize:7,fontWeight:700,padding:"1px 4px",borderRadius:3,background:s==="Google Maps"?"#e8f0fe":"#f0f0ff",color:s==="Google Maps"?"#1a73e8":"#6366f1"}}>{s}</span>)}
                    </div>}
                  </div>

                  {d.urbanisme_result.mairie.email&&<div style={{marginBottom:5}}>
                    <div style={{fontSize:10,color:"var(--tx4)",fontWeight:600}}>Email</div>
                    <div style={{fontSize:12,fontWeight:700,color:"#1A4A8A",wordBreak:"break-all"}}>{d.urbanisme_result.mairie.email}</div>
                  </div>}

                  {d.urbanisme_result.mairie.telephone&&<div style={{marginBottom:5}}>
                    <div style={{fontSize:10,color:"var(--tx4)",fontWeight:600}}>Téléphone</div>
                    <div style={{fontSize:12,fontWeight:600}}>{d.urbanisme_result.mairie.telephone}</div>
                  </div>}

                  {d.urbanisme_result.mairie.adresse_complete&&<div style={{marginBottom:5}}>
                    <div style={{fontSize:10,color:"var(--tx4)",fontWeight:600}}>Adresse</div>
                    <div style={{fontSize:11}}>{d.urbanisme_result.mairie.adresse_complete}</div>
                  </div>}

                  {d.urbanisme_result.mairie.sve&&<div style={{marginBottom:5}}>
                    <div style={{fontSize:10,color:"var(--tx4)",fontWeight:600}}>SVE (Saisine par Voie Électronique)</div>
                    <a href={d.urbanisme_result.mairie.sve} target="_blank" rel="noopener noreferrer"
                      style={{fontSize:11,color:"#6366f1",wordBreak:"break-all",textDecoration:"underline"}}>{d.urbanisme_result.mairie.sve}</a>
                  </div>}

                  {d.urbanisme_result.mairie.site_internet&&<div style={{marginBottom:5}}>
                    <div style={{fontSize:10,color:"var(--tx4)",fontWeight:600}}>Site internet</div>
                    <a href={d.urbanisme_result.mairie.site_internet.startsWith("http")?d.urbanisme_result.mairie.site_internet:"https://"+d.urbanisme_result.mairie.site_internet} target="_blank" rel="noopener noreferrer"
                      style={{fontSize:11,color:"#6366f1",wordBreak:"break-all",textDecoration:"underline"}}>{d.urbanisme_result.mairie.site_internet}</a>
                  </div>}

                  {d.urbanisme_result.mairie.plage_ouverture&&d.urbanisme_result.mairie.plage_ouverture.length>0&&<div style={{marginBottom:5}}>
                    <div style={{fontSize:10,color:"var(--tx4)",fontWeight:600,marginBottom:2}}>Horaires d'ouverture</div>
                    {d.urbanisme_result.mairie.plage_ouverture.map((h,i)=><div key={i} style={{fontSize:10,color:"var(--tx3)",lineHeight:1.6}}>{h}</div>)}
                  </div>}

                  {d.urbanisme_result.mairie.google_maps&&<div>
                    <a href={d.urbanisme_result.mairie.google_maps} target="_blank" rel="noopener noreferrer"
                      style={{fontSize:10,color:"#1a73e8",textDecoration:"underline",fontWeight:600}}>📍 Voir sur Google Maps</a>
                  </div>}
                </div>}

                {!d.urbanisme_result.mairie&&<div style={{background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:"var(--r)",padding:"6px 10px",fontSize:11,color:"#b45309",marginBottom:8}}>
                  Aucune mairie trouvée pour « {d.urbanisme_result.ville} ». Vérifiez l'orthographe.
                </div>}

                {/* ── EPCI / Communauté de communes ── */}
                {d.urbanisme_result.epci&&<div style={{background:"#f0fdf4",border:"1.5px solid #bbf7d0",borderRadius:"var(--r)",padding:10,marginBottom:8}}>
                  <div style={{fontSize:9,fontWeight:700,color:"#059669",textTransform:"uppercase",marginBottom:6}}>{d.urbanisme_result.epci.nom||"Communauté de communes"}</div>

                  {d.urbanisme_result.epci.email&&<div style={{marginBottom:4}}>
                    <div style={{fontSize:10,color:"var(--tx4)",fontWeight:600}}>Email</div>
                    <div style={{fontSize:11,fontWeight:600,color:"#1A4A8A",wordBreak:"break-all"}}>{d.urbanisme_result.epci.email}</div>
                  </div>}

                  {d.urbanisme_result.epci.telephone&&<div style={{marginBottom:4}}>
                    <div style={{fontSize:10,color:"var(--tx4)",fontWeight:600}}>Téléphone</div>
                    <div style={{fontSize:11}}>{d.urbanisme_result.epci.telephone}</div>
                  </div>}

                  {d.urbanisme_result.epci.sve&&<div>
                    <div style={{fontSize:10,color:"var(--tx4)",fontWeight:600}}>SVE</div>
                    <a href={d.urbanisme_result.epci.sve} target="_blank" rel="noopener noreferrer"
                      style={{fontSize:11,color:"#059669",wordBreak:"break-all",textDecoration:"underline"}}>{d.urbanisme_result.epci.sve}</a>
                  </div>}
                </div>}

                {/* Footer */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6,padding:"4px 0"}}>
                  <span style={{fontSize:9,color:"#6366f1",fontWeight:600}}>Sources : service-public.fr + Google + scan GNAU</span>
                  <span style={{fontSize:9,color:"var(--tx4)"}}>{d.urbanisme_result.date_recherche?new Date(d.urbanisme_result.date_recherche).toLocaleDateString("fr-FR"):""}</span>
                </div>
              </div>}

              {!d.urbanisme_result&&!urbLoading&&<div style={{fontSize:11,color:"#6366f1",fontStyle:"italic",marginTop:8,textAlign:"center"}}>
                Saisissez la ville puis cliquez pour lancer la recherche
              </div>}
            </div>

            {/* ── Contact mairie (existant) ── */}
            <div style={{background:"var(--or-l)",border:"1.5px solid rgba(232,80,26,.25)",borderRadius:"var(--rl)",padding:14}}>
              <div style={{fontSize:11,fontWeight:800,color:"var(--or)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>⏰ Contact mairie</div>

              {/* Date envoi DP */}
              <div className="fg" style={{marginBottom:10}}>
                <label className="lbl">Date d'envoi DP <span style={{fontSize:9,color:"var(--or)",fontWeight:600,background:"rgba(232,80,26,.1)",padding:"1px 5px",borderRadius:6}}>J+6</span></label>
                <input type="date" value={d.date_envoi_dp||""} onChange={e=>save({date_envoi_dp:e.target.value})} style={{fontSize:12}}/>
              </div>
              {/* Email mairie */}
              <div className="fg" style={{marginBottom:10}}>
                <label className="lbl">Email mairie <span style={{fontSize:9,color:"var(--or)",fontWeight:600,background:"rgba(232,80,26,.1)",padding:"1px 5px",borderRadius:6}}>J+30</span></label>
                <input type="email" value={d.mairie_email||""} placeholder="urbanisme@mairie-xxx.fr"
                  onChange={e=>save({mairie_email:e.target.value})}
                  style={{fontSize:12}}/>
              </div>

              {/* Notes contact mairie */}
              <div className="fg" style={{marginBottom:10}}>
                <label className="lbl">Notes / Interlocuteur</label>
                <textarea value={d.mairie_contact_note||""} placeholder="Nom, téléphone, horaires..."
                  onChange={e=>save({mairie_contact_note:e.target.value})}
                  style={{minHeight:60,fontSize:12,resize:"vertical"}}/>
              </div>

              {/* Email résolu — source affichée */}
              <div style={{background:"var(--bg2)",border:"1.5px solid var(--bd)",borderRadius:"var(--r)",padding:"8px 10px"}}>
                <div style={{fontSize:9,fontWeight:700,color:"var(--tx4)",textTransform:"uppercase",marginBottom:4}}>Email utilisé pour les relances</div>
                {mairieResolved
                  ?<>
                    <div style={{fontSize:12,fontWeight:700,color:"#1A4A8A",wordBreak:"break-all"}}>{mairieResolved.email}</div>
                    <div style={{fontSize:10,color:"var(--tx4)",marginTop:3}}>
                      {mairieResolved.source==="champ dédié"
                        ?<span style={{color:"#059669",fontWeight:600}}>✓ Champ dédié</span>
                        :<span style={{color:"#d97706",fontWeight:600}}>🔍 Trouvé dans : {mairieResolved.source}</span>
                      }
                    </div>
                  </>
                  :<div style={{fontSize:12,color:"var(--tx4)",fontStyle:"italic"}}>Aucun email mairie trouvé.<br/>Saisissez-le ci-dessus ou mentionnez-le dans un commentaire.</div>
                }
              </div>
            </div>
          </div>
        </div>}

        {tab==="paiement"&&isSA&&<div>
          <div style={{background:d.paid?"var(--gr-l)":"#fffbeb",border:"1.5px solid "+(d.paid?"#a7f3d0":"#fcd34d"),borderRadius:"var(--rl)",padding:18,marginBottom:16}}>
            <div style={{fontSize:9,fontWeight:700,color:"var(--tx3)",textTransform:"uppercase",marginBottom:5}}>Montant</div>
            <div style={{fontWeight:800,fontSize:28,color:d.paid?"var(--gr)":"var(--or)"}}>{(d.amount||0).toLocaleString("fr-FR")} €</div>
            <div style={{marginTop:8}}><SBadge status={d.paid?"valide":"en_attente"}/></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-g btn-sm" disabled={d.paid} style={{opacity:d.paid?.5:1}} onClick={()=>{save({paid:true});toast("Paiement valide !","s");}}><Ic n="check" s={11}/>Marquer paye</button>
            <button className="btn btn-s btn-sm" onClick={()=>toast("Lien de paiement copie","i")}><Ic n="mail" s={11}/>Envoyer lien</button>
          </div>
        </div>}

      </div>
    </div>
    {editing&&<DossierForm initial={d} onSave={u=>{setD(u);onUpdate(u);setEditing(false);toast("Modifie","s");}} onClose={()=>setEditing(false)} currentUser={currentUser} clientsOrg={[]} onAddOrg={()=>{}}/>}
  </div>;
}

// ── PAGE DOSSIERS ──
// ── EXCEL HELPERS ──
async function loadXLSX(){
  if(window.XLSX)return window.XLSX;
  await new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";s.onload=res;s.onerror=rej;document.head.appendChild(s);});
  return window.XLSX;
}

function dossierToRow(d){
  const works=(d.works||[]).map(w=>w.type).join(" / ");
  const fmts=(d.works||[]).flatMap(w=>w.formalites||[]).filter((v,i,a)=>a.indexOf(v)===i).join(" / ");
  const kwc=(d.works||[]).map(w=>w.kwc).filter(Boolean).join(" / ");
  const st=ALL_STATUSES.find(s=>s.key===d.status);
  return {
    "ID Dossier":d.id||"",
    "Date creation":d.created||"",
    "Date modification":d.updated||"",
    "Nom client":d.client||"",
    "Organisme":d.client_org||"",
    "Email":d.email||"",
    "Telephone":d.phone||"",
    "Adresse":d.address||"",
    "Code postal":d.postal_code||"",
    "N° DP":d.dp_number||"",
    "Parcelle":d.parcelle||"",
    "Type travaux":works,
    "Formalites":fmts,
    "kWc":kwc,
    "Statut":st?.label||d.status||"",
    "Responsable":d.assignee||"",
    "Installe":d.installed?"Oui":"Non",
    "Paye":d.paid?"Oui":"Non",
    "Montant (€)":d.amount||0,
    "DP envoi":d.avancement?.dp_envoi||"",
    "DP coche":d.avancement?.dp_checked?"Oui":"Non",
    "Raccordement date":d.avancement?.racc_date||"",
    "Raccordement statut":d.avancement?.racc_status||"",
    "Raccordement note":d.avancement?.racc_note||"",
    "CONSUEL date":d.avancement?.cons_date||"",
    "CONSUEL note":d.avancement?.cons_note||"",
    "TVA date":d.avancement?.tva_date||"",
    "TVA note":d.avancement?.tva_note||"",
    "Nb commentaires":(d.comments||[]).length,
    "Nb documents":(d.docs||[]).length,
  };
}

function rowToDossier(row){
  const now=new Date().toISOString().split("T")[0];
  const statusMatch=ALL_STATUSES.find(s=>s.label===(row["Statut"]||"").trim());
  const works=(row["Type travaux"]||"").split("/").map(t=>t.trim()).filter(Boolean);
  const fmts=(row["Formalites"]||"").split("/").map(f=>f.trim()).filter(Boolean);
  return {
    id:row["ID Dossier"]||genId(),
    client:row["Nom client"]||"",
    client_org:row["Organisme"]||"",
    email:row["Email"]||"",
    phone:row["Telephone"]||"",
    address:row["Adresse"]||"",
    postal_code:row["Code postal"]||"",
    dp_number:row["N° DP"]||"",
    parcelle:row["Parcelle"]||"",
    works:works.length?works.map(t=>({type:t,formalites:fmts,kwc:row["kWc"]||"",kwc_c:""})):[{type:"ITE",formalites:[],kwc:"",kwc_c:""}],
    status:statusMatch?.key||"nouveau",
    assignee:row["Responsable"]||EMPLOYEES[0],
    installed:(row["Installe"]||"").toLowerCase()==="oui",
    paid:(row["Paye"]||"").toLowerCase()==="oui",
    amount:Number(row["Montant (€)"])||0,
    created:row["Date creation"]||now,
    updated:row["Date modification"]||now,
    docs:[],comments:[],
    avancement:{
      dp_checked:(row["DP coche"]||"").toLowerCase()==="oui",
      dp_envoi:row["DP envoi"]||"",dp_note:"",
      racc_checked:!!(row["Raccordement date"]||row["Raccordement statut"]),
      racc_date:row["Raccordement date"]||"",
      racc_status:row["Raccordement statut"]||"",
      racc_note:row["Raccordement note"]||"",
      cons_checked:!!(row["CONSUEL date"]),
      cons_date:row["CONSUEL date"]||"",cons_note:row["CONSUEL note"]||"",
      tva_checked:!!(row["TVA date"]),
      tva_date:row["TVA date"]||"",tva_note:row["TVA note"]||"",
    },
  };
}

function Dossiers({dossiers,setDossiers,currentUser,toast,addNotif,globalQ,globalFilters,clientsOrg,setClientsOrg}){
  const isSA=currentUser.role==="superadmin";
  const [creating,setCreating]=useState(false);const [sel,setSel]=useState(null);const [confirm,setConfirm]=useState(null);
  const [importing,setImporting]=useState(false);const [preview,setPreview]=useState(null);
  const xlsRef=useRef();

  const filtered=useMemo(()=>dossiers.filter(d=>{
    const q=(globalQ||"").toLowerCase();
    const mq=!q||d.client.toLowerCase().includes(q)||d.address.toLowerCase().includes(q)||(d.postal_code||"").includes(q)||(d.dp_number||"").toLowerCase().includes(q)||(d.id||"").includes(q);
    const ms=!globalFilters.status||d.status===globalFilters.status;
    const ma=!globalFilters.assignee||d.assignee===globalFilters.assignee;
    const mw=!globalFilters.work||d.works.some(w=>w.type===globalFilters.work);
    const mf=!globalFilters.formalite||d.works.some(w=>(w.formalites||[]).includes(globalFilters.formalite));
    const mn=!globalFilters.client_name||d.client.toLowerCase().includes(globalFilters.client_name.toLowerCase());
    const mcd=!globalFilters.date_created||(d.created&&d.created>=globalFilters.date_created);
    const mud=!globalFilters.date_updated||(d.updated&&d.updated>=globalFilters.date_updated);
    return mq&&ms&&ma&&mw&&mf&&mn&&mcd&&mud;
  }),[dossiers,globalQ,globalFilters]);

  const create=d=>{const nd={...d,id:dossierId(d.dp_number,d.id),created_by:currentUser.id};setDossiers(p=>[nd,...p]);setCreating(false);toast("Dossier cree !","s");};
  const upd=d=>{
    // Si l'ID a changé (DP extrait → nouvel ID), on retrouve l'ancien via _oldId
    const lookupId=d._oldId||d.id;
    setDossiers(p=>p.map(x=>x.id===lookupId||x.id===d.id?d:x));
    setSel(d);
  };
  const del=id=>{setDossiers(p=>p.filter(x=>x.id!==id));setSel(null);setConfirm(null);toast("Supprime","i");};

  // ── EXPORT EXCEL ──
  const exportXLS=async()=>{
    try{
      const XLSX=await loadXLSX();
      const rows=filtered.map(dossierToRow);
      const ws=XLSX.utils.json_to_sheet(rows);
      // Column widths
      const cols=[{wch:20},{wch:12},{wch:16},{wch:22},{wch:18},{wch:24},{wch:14},{wch:32},{wch:12},{wch:22},{wch:10},{wch:20},{wch:22},{wch:12},{wch:22},{wch:12},{wch:8},{wch:8},{wch:10},{wch:12},{wch:8},{wch:16},{wch:18},{wch:20},{wch:14},{wch:14},{wch:10},{wch:10},{wch:8},{wch:8}];
      ws["!cols"]=cols;
      // Header row styling (xlsx doesn't support cell styles in free version, but set freeze)
      ws["!freeze"]={xSplit:0,ySplit:1};
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,ws,"Dossiers");
      // Second sheet: template vide
      const tplRows=[dossierToRow({id:"",client:"",client_org:"",email:"",phone:"",address:"",postal_code:"",dp_number:"",parcelle:"",works:[{type:"ITE",formalites:[],kwc:""}],status:"nouveau",assignee:"",installed:false,paid:false,amount:0,created:"",updated:"",docs:[],comments:[],avancement:{}})];
      const ws2=XLSX.utils.json_to_sheet(tplRows);
      ws2["!cols"]=cols;
      XLSX.utils.book_append_sheet(wb,ws2,"Modele import");
      const date=new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb,`SolarCRM_Export_${date}.xlsx`);
      toast("Export Excel telechargé ("+filtered.length+" dossiers)","s");
    }catch(e){console.error(e);toast("Erreur export Excel","e");}
  };

  // ── IMPORT EXCEL ──
  const handleXLS=async(file)=>{
    if(!file)return;
    setImporting(true);
    try{
      const XLSX=await loadXLSX();
      const buf=await file.arrayBuffer();
      const wb=XLSX.read(buf,{type:"array"});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:""});
      if(!rows.length){toast("Fichier vide ou format incorrect","e");setImporting(false);return;}
      const parsed=rows.map(rowToDossier);
      setPreview({rows:parsed,fileName:file.name});
    }catch(e){console.error(e);toast("Erreur lecture Excel","e");}
    setImporting(false);
  };

  const confirmImport=(mode)=>{
    if(!preview)return;
    if(mode==="replace"){
      setDossiers(preview.rows);
      toast(preview.rows.length+" dossiers importes (remplacement)","s");
    }else{
      // merge: update existing by ID, add new ones
      const existing=new Map(dossiers.map(d=>[d.id,d]));
      preview.rows.forEach(r=>{existing.set(r.id,r);});
      setDossiers([...existing.values()]);
      toast(preview.rows.length+" dossiers importes (fusion)","s");
    }
    setPreview(null);
  };

  const getRacc=d=>{
    const rs=d.avancement?.racc_status||"";
    const rd=d.avancement?.racc_date||"";
    if(!rs&&!rd)return <span style={{color:"var(--tx4)",fontSize:11}}>—</span>;
    const raccStColor={
      "Mise en service":{bg:"#ecfdf5",border:"#a7f3d0",tx:"#059669"},
      "Mise en service programmée":{bg:"#EEF3FD",border:"#bfdbfe",tx:"#1A4A8A"},
      "Réenvoi":{bg:"#fef2f2",border:"#fca5a5",tx:"#dc2626"},
      "Complet":{bg:"var(--gr-l)",border:"#a7f3d0",tx:"var(--gr)"},
    };
    const c=raccStColor[rs]||{bg:"var(--or-l)",border:"rgba(232,80,26,.3)",tx:"var(--or)"};
    return <div style={{display:"flex",flexDirection:"column",gap:2}}>
      {rs&&<span style={{background:c.bg,color:c.tx,fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:4,border:"1px solid "+c.border}}>{rs}</span>}
      {rd&&<span style={{fontSize:10,color:"var(--tx4)"}}>{rd}</span>}
    </div>;
  };
  const getCons=d=>{
    const cs=d.avancement?.cons_status||"";
    const cd=d.avancement?.cons_date||"";
    if(!cs&&!cd)return <span style={{color:"var(--tx4)",fontSize:11}}>—</span>;
    const consColor={"Positif":{bg:"#ecfdf5",border:"#a7f3d0",tx:"#059669"},"Envoyé au CONSUEL":{bg:"#EEF3FD",border:"#bfdbfe",tx:"#1A4A8A"}};
    const c=consColor[cs]||{bg:"var(--gr-l)",border:"#a7f3d0",tx:"var(--gr)"};
    return <div style={{display:"flex",flexDirection:"column",gap:2}}>
      {cs&&<span style={{background:c.bg,color:c.tx,fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:4,border:"1px solid "+c.border}}>{cs}</span>}
      {cd&&<span style={{fontSize:10,color:"var(--tx4)"}}>{cd}</span>}
    </div>;
  };
  const getRec=d=>{
    const ds=d.avancement?.dp_status||"";
    const de=d.avancement?.dp_envoi||"";
    if(!ds&&!de&&!d.avancement?.dp_checked)return <span style={{color:"var(--tx4)",fontSize:11}}>—</span>;
    const dpColor={"Récépissé reçu":{bg:"#ecfdf5",border:"#a7f3d0",tx:"#059669"},"Incomplet":{bg:"#fffbeb",border:"#fcd34d",tx:"#b45309"},"Réenvoi":{bg:"#fef2f2",border:"#fca5a5",tx:"#dc2626"}};
    const c=dpColor[ds]||{bg:"var(--bl-l)",border:"#bfdbfe",tx:"var(--bl)"};
    return <div style={{display:"flex",flexDirection:"column",gap:2}}>
      {ds&&<span style={{background:c.bg,color:c.tx,fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:4,border:"1px solid "+c.border}}>{ds}</span>}
      {de&&<span style={{fontSize:10,color:"var(--tx4)"}}>{de}</span>}
    </div>;
  };

  return <div>
    {confirm&&<Confirm msg={"Supprimer le dossier de "+confirm.client+" ?"} onOk={()=>del(confirm.id)} onNo={()=>setConfirm(null)}/>}

    {/* ── IMPORT PREVIEW MODAL ── */}
    {preview&&<div className="ov" onClick={e=>e.target===e.currentTarget&&setPreview(null)}>
      <div className="modal" style={{maxWidth:780}}>
        <div className="mhdr">
          <div>
            <h2 style={{fontSize:16,fontWeight:800}}>Apercu import Excel</h2>
            <div style={{fontSize:11,color:"var(--tx3)",marginTop:2}}>{preview.fileName} — {preview.rows.length} dossier(s) detecte(s)</div>
          </div>
          <button className="bic" onClick={()=>setPreview(null)}><Ic n="x"/></button>
        </div>
        <div className="mbdy">
          <div style={{overflowX:"auto",marginBottom:16,maxHeight:320,overflowY:"auto",border:"1.5px solid var(--bd)",borderRadius:"var(--r)"}}>
            <table>
              <thead><tr>
                {["ID","Client","Organisme","Statut","Travaux","Responsable","Installe","Paye","Montant"].map(h=><th key={h}>{h}</th>)}
              </tr></thead>
              <tbody>
                {preview.rows.slice(0,20).map((d,i)=><tr key={i}>
                  <td style={{fontSize:10,color:"var(--or)"}}>{d.id}</td>
                  <td style={{fontWeight:600}}>{d.client||<span style={{color:"var(--re)"}}>— Manquant</span>}</td>
                  <td>{d.client_org}</td>
                  <td><SBadge status={d.status}/></td>
                  <td><div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{(d.works||[]).map((w,j)=><WChip key={j} type={w.type}/>)}</div></td>
                  <td>{d.assignee}</td>
                  <td>{d.installed?"✓ Oui":"—"}</td>
                  <td>{d.paid?"✓ Oui":"—"}</td>
                  <td style={{fontWeight:700}}>{d.amount?d.amount.toLocaleString("fr-FR")+" €":"—"}</td>
                </tr>)}
              </tbody>
            </table>
            {preview.rows.length>20&&<div style={{padding:"8px 12px",fontSize:11,color:"var(--tx4)",textAlign:"center",borderTop:"1.5px solid var(--bd)"}}>... et {preview.rows.length-20} autres</div>}
          </div>
          <div style={{background:"var(--or-l)",border:"1.5px solid rgba(232,80,26,.3)",borderRadius:"var(--r)",padding:"12px 14px",fontSize:12,marginBottom:4}}>
            <strong style={{color:"var(--or)"}}>Choisir le mode d import :</strong>
            <div style={{marginTop:8,display:"flex",gap:9,flexWrap:"wrap"}}>
              <button className="btn btn-p" onClick={()=>confirmImport("merge")}><Ic n="import" s={13}/>Fusionner avec l existant</button>
              <button className="btn btn-d" onClick={()=>confirmImport("replace")}><Ic n="trash" s={13}/>Remplacer tous les dossiers</button>
              <button className="btn btn-s" onClick={()=>setPreview(null)}>Annuler</button>
            </div>
            <div style={{fontSize:10,color:"var(--tx3)",marginTop:8}}>Fusion : met à jour les dossiers existants (même ID) et ajoute les nouveaux. Remplacer : efface tous les dossiers actuels.</div>
          </div>
        </div>
      </div>
    </div>}

    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:9}}>
      <div><h2 style={{fontSize:19,fontWeight:800}}>Dossiers</h2><p style={{color:"var(--tx3)",fontSize:11,marginTop:1}}>{filtered.length}/{dossiers.length} dossier(s)</p></div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
        {/* IMPORT EXCEL */}
        <input ref={xlsRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])handleXLS(e.target.files[0]);e.target.value="";}}/>
        <button className="btn btn-s" onClick={()=>xlsRef.current&&xlsRef.current.click()} disabled={importing}>
          <Ic n="import" s={13} c="var(--gr)"/>{importing?"Lecture...":"Importer Excel"}
        </button>
        {/* EXPORT EXCEL */}
        <button className="btn btn-s" onClick={exportXLS}>
          <Ic n="dl" s={13} c="var(--bl)"/>Exporter Excel{filtered.length<dossiers.length?" (filtre)":""}
        </button>
        <button className="btn btn-p" onClick={()=>setCreating(true)}><Ic n="plus" s={13}/>Nouveau dossier</button>
      </div>
    </div>
    <div className="card" style={{padding:0,overflow:"hidden"}}>
      <div style={{overflowX:"auto"}}>
        <table>
          <thead><tr>
            <th>Date</th><th>Client</th><th>Travaux</th><th>Adresse</th><th>Statut</th>
            {isSA&&<th>Responsable</th>}
            <th>Raccordement</th><th>CONSUEL</th><th>Recepisse</th>
            {isSA&&<th>Paye</th>}
            <th></th>
          </tr></thead>
          <tbody>
            {!filtered.length&&<tr><td colSpan={12} style={{textAlign:"center",padding:32,color:"var(--tx4)"}}>Aucun resultat</td></tr>}
            {filtered.map(d=><tr key={d.id} style={{cursor:"pointer",userSelect:"text"}} onClick={()=>{const s=window.getSelection();if(s&&s.toString().length>0)return;setSel(d);}}>
              <td><div style={{fontWeight:800,fontSize:11,color:"var(--or)",whiteSpace:"nowrap"}}>{d.id}</div><div className="ago">modifié {timeAgo(d.updated)}</div></td>
              <td><div style={{fontWeight:700,fontSize:14}}>{d.client}</div>{d.client_org&&<div style={{fontSize:11,color:"var(--tx4)"}}>{d.client_org}</div>}</td>
              <td><div style={{display:"flex",flexWrap:"wrap",gap:3}}>{(d.works||[]).map((w,i)=><WChip key={i} type={w.type}/>)}</div></td>
              <td style={{maxWidth:160}}><div style={{fontSize:12,color:"var(--tx2)",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.address}</div>{d.postal_code&&<div style={{fontSize:12,fontWeight:700,color:"var(--tx3)",marginTop:1}}>{d.postal_code}</div>}</td>
              <td><SBadge status={d.status}/>{d.installed&&<div style={{marginTop:3,fontSize:10,color:"#065f46",fontWeight:700}}>✓ Installe</div>}</td>
              {isSA&&<td>{d.assignee?<span className="asgn"><span className="av-ico">{d.assignee[0]}</span>{d.assignee}</span>:<span style={{fontSize:11,color:"var(--tx4)",fontStyle:"italic"}}>—</span>}</td>}
              <td>{getRacc(d)}</td><td>{getCons(d)}</td><td>{getRec(d)}</td>
              {isSA&&<td><span style={{color:d.paid?"var(--gr)":"var(--tx4)",fontSize:11,fontWeight:600}}>{d.paid?"✓ Paye":"—"}</span></td>}
              <td onClick={e=>e.stopPropagation()}><div style={{display:"flex",gap:4}}>
                <button className="bic" onClick={()=>setSel(d)}><Ic n="eye" s={11}/></button>
                <button className="bic" onClick={()=>openChatForDossier(d)} title="Ouvrir le chat"><Ic n="msg" s={11}/></button>
                {isSA&&<button className="bic" style={{color:"var(--re)"}} onClick={()=>setConfirm(d)}><Ic n="trash" s={11}/></button>}
              </div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
    {creating&&<DossierForm onSave={create} onClose={()=>setCreating(false)} currentUser={currentUser} clientsOrg={clientsOrg} onAddOrg={n=>setClientsOrg(p=>[...p,{id:Date.now(),name:n,address:"",siret:"",representant:"",email:""}])}/>}
    {sel&&<DossierDetail dossier={sel} onClose={()=>setSel(null)} onUpdate={upd} currentUser={currentUser} addNotif={addNotif} toast={toast}/>}
  </div>;
}

// ── DASHBOARD ──
function Dashboard({dossiers}){
  const tot=dossiers.length;
  const empD=EMPLOYEES.map(e=>({name:e,count:dossiers.filter(d=>d.assignee===e).length})).filter(e=>e.count>0).sort((a,b)=>b.count-a.count);
  const maxE=Math.max(...empD.map(e=>e.count),1);
  const installs=dossiers.filter(d=>d.installed).length;
  const paid=dossiers.filter(d=>d.paid).reduce((s,d)=>s+(d.amount||0),0);
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:11,marginBottom:18}}>
      {[{l:"Total dossiers",v:tot,c:"var(--or)"},{l:"Installes",v:installs,c:"var(--gr)"},{l:"Impayes",v:dossiers.filter(d=>!d.paid).length,c:"var(--re)"},{l:"CA encaisse",v:paid.toLocaleString("fr-FR")+" €",c:"var(--bl)"}].map((s,i)=><div key={i} className="scard" style={{"--sc":s.c}}><div style={{fontSize:typeof s.v==="string"?16:28,fontWeight:800,lineHeight:1,marginBottom:3,letterSpacing:"-.04em",color:s.c}}>{s.v}</div><div style={{fontSize:11,color:"var(--tx3)"}}>{s.l}</div></div>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
      <div className="card"><h3 style={{fontSize:12,fontWeight:800,marginBottom:12}}>Statuts</h3>
        {ALL_STATUSES.filter(s=>dossiers.some(d=>d.status===s.key)).map(s=>{const c=dossiers.filter(d=>d.status===s.key).length;return<div key={s.key} style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
          <span className="sdot" style={{width:7,height:7,borderRadius:"50%",background:s.color,flexShrink:0}}/>
          <span style={{fontSize:11,flex:1}}>{s.label}</span>
          <div style={{flex:2,background:"var(--bd)",borderRadius:3,height:5,overflow:"hidden"}}><div style={{width:(tot?c/tot*100:0)+"%",height:"100%",background:s.color,borderRadius:3}}/></div>
          <span style={{fontSize:10,color:"var(--tx4)",width:16,textAlign:"right",fontWeight:700}}>{c}</span>
        </div>;})}
      </div>
      <div className="card"><h3 style={{fontSize:12,fontWeight:800,marginBottom:12}}>Equipe</h3>
        {empD.slice(0,8).map(e=><div key={e.name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <span style={{fontSize:10,fontWeight:700,width:62,flexShrink:0}}>{e.name}</span>
          <div style={{flex:1,background:"var(--bd)",borderRadius:3,height:5,overflow:"hidden"}}><div style={{width:(e.count/maxE*100)+"%",height:"100%",background:"var(--or)",borderRadius:3}}/></div>
          <span style={{fontSize:10,color:"var(--tx4)",width:14,textAlign:"right",fontWeight:700}}>{e.count}</span>
        </div>)}
        {!empD.length&&<p style={{color:"var(--tx4)",fontSize:12}}>Aucun dossier</p>}
      </div>
    </div>
    <div className="card">
      <h3 style={{fontSize:12,fontWeight:800,marginBottom:12}}>Travaux</h3>
      <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
        {WORK_TYPES.map(wt=>{const c=dossiers.filter(d=>(d.works||[]).some(w=>w.type===wt)).length;const col=WORK_COLORS[wt];return<div key={wt} style={{flex:"1",minWidth:80,padding:"9px 12px",borderRadius:"var(--r)",background:col+"18",border:"1.5px solid "+col+"30"}}>
          <div style={{fontSize:8,color:col,marginBottom:2,fontWeight:800,textTransform:"uppercase"}}>{wt}</div>
          <div style={{fontSize:18,fontWeight:800,color:col}}>{c}</div>
        </div>;})}
      </div>
    </div>
  </div>;
}

// ── CLIENTS ──
function Clients({dossiers,clientsOrg,setClientsOrg,toast}){
  const [q,setQ]=useState("");const [creating,setCreating]=useState(false);const [editC,setEditC]=useState(null);
  const [f,setF]=useState({name:"",address:"",siret:"",representant:"",email:""});
  const [scan,setScan]=useState(false);const [kbR,setKbR]=useState(null);const kRef=useRef();
  const filtered=clientsOrg.filter(c=>!q||c.name.toLowerCase().includes(q.toLowerCase())||c.siret?.includes(q));
  const save=()=>{
    if(!f.name.trim())return;
    if(editC){setClientsOrg(p=>p.map(c=>c.id===editC.id?{...c,...f}:c));}
    else{setClientsOrg(p=>[...p,{id:Date.now(),...f}]);}
    setCreating(false);setEditC(null);setF({name:"",address:"",siret:"",representant:"",email:""});
    toast("Partenaire sauvegarde","s");
  };
  const scanKbisClient=async(file)=>{
    const isPdf=file.type?.includes("pdf");const isImg=file.type?.startsWith("image/");
    if(!isPdf&&!isImg)return toast("Formats acceptés : PDF, JPG, PNG","e");
    setScan(isImg?"ocr":true);setKbR(null);
    const res=await extractKbis(file);
    setScan(false);
    if(res&&(res.siret||res.company_name)){
      setKbR(res);
      setF(x=>({...x,...(res.company_name?{name:res.company_name}:{}),...(res.siret?{siret:res.siret}:{}),...(res.address?{address:res.address}:{}),...(res.representant?{representant:res.representant}:{})}));
      toast("Données KBIS extraites avec succès","s");
    }else{setKbR({error:"Aucune donnée KBIS trouvée"});toast("Aucune donnée KBIS trouvée","e");}
  };
  const openEdit=(c)=>{setEditC(c);setF({name:c.name,address:c.address||"",siret:c.siret||"",representant:c.representant||"",email:c.email||""});setCreating(true);};
  const prepEmail=(c)=>{const s=encodeURIComponent("Contact — "+c.name);const b=encodeURIComponent("Bonjour,\n\nSuite a notre echange concernant vos dossiers en cours...\n\nCordialement,\nEco Formalites");window.open("mailto:"+c.email+"?subject="+s+"&body="+b);};
  return <div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:9}}>
      <h2 style={{fontSize:19,fontWeight:800}}>Partenaires <span style={{fontSize:13,color:"var(--tx3)",fontWeight:500}}>({filtered.length})</span></h2>
      <button className="btn btn-p" onClick={()=>{setEditC(null);setF({name:"",address:"",siret:"",representant:"",email:""});setCreating(true);}}><Ic n="plus" s={13}/>Ajouter partenaire</button>
    </div>
    <div className="srw" style={{marginBottom:14}}><span className="srw-ic"><Ic n="search" s={13}/></span><input className="srch" placeholder="Nom, SIRET..." value={q} onChange={e=>setQ(e.target.value)}/></div>
    {creating&&<div className="ov" onClick={e=>{if(e.target===e.currentTarget){setCreating(false);setEditC(null);setF({name:"",address:"",siret:"",representant:"",email:""});setScan(false);setKbR(null);}}}>
      <div className="modal" style={{maxWidth:580}}>
        <div className="mhdr"><h2 style={{fontSize:16,fontWeight:800}}>{editC?"Modifier":"Nouveau partenaire"}</h2><button className="bic" onClick={()=>{setCreating(false);setEditC(null);setF({name:"",address:"",siret:"",representant:"",email:""});setScan(false);setKbR(null);}}><Ic n="x"/></button></div>
        <div className="mbdy">
          {/* KBIS extraction */}
          <div style={{background:"var(--or-l)",border:"1.5px solid rgba(232,80,26,.25)",borderRadius:"var(--rl)",padding:14,marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:800,color:"var(--or)",marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>Extraction KBIS — Pré-remplissage automatique</div>
            <div
              onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor="var(--or)";if(e.dataTransfer.files?.[0])scanKbisClient(e.dataTransfer.files[0]);}}
              onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="var(--or)";}}
              onDragLeave={e=>{e.currentTarget.style.borderColor="rgba(232,80,26,.3)";}}
              onClick={()=>!scan&&kRef.current?.click()}
              style={{border:"2px dashed rgba(232,80,26,.3)",borderRadius:"var(--r)",padding:"18px 12px",textAlign:"center",cursor:scan?"not-allowed":"pointer",background:scan?"#fef6f2":"#fff",transition:"all .15s"}}
            >
              <input ref={kRef} type="file" accept=".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])scanKbisClient(e.target.files[0]);e.target.value="";}}/>
              {scan?<div style={{display:"flex",gap:6,justifyContent:"center",fontSize:12,color:"var(--tx3)"}}><span style={{animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span>{scan==="ocr"?"OCR en cours sur image KBIS...":"Analyse du KBIS en cours..."}</div>
              :<div><div style={{fontSize:13,fontWeight:600,color:"var(--or)"}}>Glisser un KBIS ici (PDF, JPG, PNG)</div><div style={{fontSize:11,color:"#6B6B60",marginTop:3}}>Nom entreprise, adresse et représentant extraits automatiquement</div></div>}
            </div>
            {kbR&&!kbR.error&&<div style={{background:"#ecfdf5",border:"1px solid #a7f3d0",borderRadius:"var(--r)",padding:"10px 12px",marginTop:8}}>
              <div style={{fontSize:11,fontWeight:700,color:"#059669",marginBottom:4}}>Donnees KBIS extraites avec succes</div>
              {kbR.company_name&&<div style={{fontSize:11}}><span style={{color:"#6B6B60"}}>Nom entreprise : </span><strong>{kbR.company_name}</strong></div>}
              {kbR.address&&<div style={{fontSize:11}}><span style={{color:"#6B6B60"}}>Adresse : </span><strong>{kbR.address}</strong></div>}
              {kbR.representant&&<div style={{fontSize:11}}><span style={{color:"#6B6B60"}}>Représentant : </span><strong>{kbR.representant}</strong></div>}
            </div>}
            {kbR?.error&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:"var(--r)",padding:"7px 10px",fontSize:11,color:"#b91c1c",marginTop:8}}>{kbR.error}</div>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div className="fg" style={{gridColumn:"1/-1"}}><label className="lbl">Nom entreprise *</label><input value={f.name} onChange={e=>setF(x=>({...x,name:e.target.value}))}/></div>
            <div className="fg" style={{gridColumn:"1/-1"}}><label className="lbl">Adresse</label><input value={f.address} onChange={e=>setF(x=>({...x,address:e.target.value}))}/></div>
            <div className="fg"><label className="lbl">Representant</label><input value={f.representant} onChange={e=>setF(x=>({...x,representant:e.target.value}))}/></div>
            <div className="fg"><label className="lbl">SIRET</label><input value={f.siret} onChange={e=>setF(x=>({...x,siret:e.target.value})) } placeholder="000 000 000 00000"/></div>
            <div className="fg" style={{gridColumn:"1/-1"}}><label className="lbl">Email</label><input type="email" value={f.email} onChange={e=>setF(x=>({...x,email:e.target.value}))}/></div>
          </div>
        </div>
        <div className="mftr"><button className="btn btn-s" onClick={()=>{setCreating(false);setEditC(null);setF({name:"",address:"",siret:"",representant:"",email:""});setScan(false);setKbR(null);}}>Annuler</button><button className="btn btn-p" onClick={save}><Ic n="check" s={13}/>Sauvegarder</button></div>
      </div>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:11}}>
      {!filtered.length&&<p style={{color:"var(--tx4)",fontSize:12}}>Aucun partenaire</p>}
      {filtered.map(c=>{const doss=dossiers.filter(d=>d.client_org===c.name);return<div className="card" key={c.id}>
        <div style={{display:"flex",gap:10,marginBottom:10}}>
          <div className="av" style={{width:42,height:42,fontSize:14,borderRadius:11,flexShrink:0}}>{c.name[0]}</div>
          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{c.name}</div><div style={{fontSize:10,color:"var(--tx3)",marginTop:1}}>{c.email}</div></div>
          <span style={{background:"var(--or-l)",color:"var(--or)",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,border:"1px solid rgba(232,80,26,.2)",flexShrink:0}}>{doss.length} dossier{doss.length!==1?"s":""}</span>
        </div>
        {c.representant&&<div style={{fontSize:11,color:"var(--tx2)",marginBottom:2}}><strong>Rep. :</strong> {c.representant}</div>}
        {c.siret&&<div style={{fontSize:11,color:"var(--tx3)",marginBottom:2}}>SIRET: {c.siret}</div>}
        {c.address&&<div style={{fontSize:11,color:"var(--tx3)",marginBottom:10}}>{c.address}</div>}
        <div style={{display:"flex",gap:6}}>
          <button className="btn btn-s btn-sm" onClick={()=>openEdit(c)}><Ic n="edit" s={10}/>Modifier</button>
          {c.email&&<button className="btn btn-s btn-sm" onClick={()=>prepEmail(c)}><Ic n="mail" s={10}/>Preparer email</button>}
        </div>
      </div>;})}
    </div>
  </div>;
}

// ── PAIEMENTS ──
function Paiements({dossiers,setDossiers,currentUser,toast,clientsOrg=[],users=[]}){
  const isSA=currentUser.role==="superadmin";
  const unpaid=dossiers.filter(d=>!d.paid);const paid=dossiers.filter(d=>d.paid);
  const mark=(id)=>{setDossiers(p=>p.map(d=>d.id===id?{...d,paid:true}:d));toast("Paiement validé","s");};
  const markAll=(ids)=>{setDossiers(p=>p.map(d=>ids.includes(d.id)?{...d,paid:true}:d));toast(ids.length+" dossier(s) marqués payés","s");};

  // ── Regrouper par partenaire (client_org) et périodes de 3 semaines ──
  const THREE_WEEKS=21*24*60*60*1000;
  const now=Date.now();

  // Trouver les partenaires ayant des dossiers
  const partnerMap={};
  dossiers.forEach(d=>{
    const org=d.client_org||"Sans partenaire";
    if(!partnerMap[org])partnerMap[org]={name:org,dossiers:[],unpaid:[],paid:[],totalDue:0,totalPaid:0};
    partnerMap[org].dossiers.push(d);
    if(d.paid){partnerMap[org].paid.push(d);partnerMap[org].totalPaid+=(d.amount||0);}
    else{partnerMap[org].unpaid.push(d);partnerMap[org].totalDue+=(d.amount||0);}
  });
  const partners=Object.values(partnerMap).sort((a,b)=>b.totalDue-a.totalDue);

  // Regrouper les dossiers impayés par période de 3 semaines
  const groupByPeriod=(docs)=>{
    const periods={};
    docs.forEach(d=>{
      const created=new Date(d.created||d.updated||now).getTime();
      const weeksAgo=Math.floor((now-created)/THREE_WEEKS);
      const periodStart=new Date(now-((weeksAgo+1)*THREE_WEEKS));
      const periodEnd=new Date(now-(weeksAgo*THREE_WEEKS));
      const key=weeksAgo;
      if(!periods[key])periods[key]={start:periodStart,end:periodEnd,dossiers:[],total:0,label:weeksAgo===0?"Période en cours (3 dernières semaines)":weeksAgo===1?"Semaine 4 à 6":"Il y a "+(weeksAgo*3+1)+" à "+((weeksAgo+1)*3)+" semaines"};
      periods[key].dossiers.push(d);
      periods[key].total+=(d.amount||0);
    });
    return Object.values(periods).sort((a,b)=>a.start-b.start);
  };

  // ── Envoi email lien de paiement ──
  const [sending,setSending]=useState(null);
  const sendPaymentLink=async(partner)=>{
    // Trouver l'email du partenaire
    const orgData=clientsOrg.find(c=>c.name===partner.name);
    const partnerUser=users.find(u=>u.role==="partenaire"&&u.name===partner.name);
    const email=orgData?.email||partnerUser?.email;
    if(!email){toast("Aucun email trouvé pour "+partner.name,"e");return;}

    setSending(partner.name);
    const dossierLines=partner.unpaid.map(d=>"  - "+d.client+" ("+d.id+") : "+(d.amount||0).toLocaleString("fr-FR")+" €").join("\n");
    const total=partner.totalDue.toLocaleString("fr-FR");
    const subject="Eco-formalités — Paiement en attente : "+total+" €";
    const body=`Bonjour,\n\nVous avez ${partner.unpaid.length} dossier(s) en attente de paiement pour un total de ${total} € :\n\n${dossierLines}\n\nMerci de procéder au règlement dans les meilleurs délais.\n\nCordialement,\nEco-formalités`;

    try{
      const API_URL=import.meta.env.VITE_API_URL||'http://localhost:3001/api';
      const token=localStorage.getItem('auth_token');
      const res=await fetch(API_URL+'/emails/send',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({to:email,to_name:partner.name,subject,body_html:body.replace(/\n/g,'<br>'),body_text:body,from_email:currentUser.email,from_name:currentUser.name})});
      if(res.ok)toast("Lien de paiement envoyé à "+email,"s");
      else{const e=await res.json().catch(()=>({}));toast(e.error||"Erreur d'envoi","e");}
    }catch(e){
      // Fallback mailto
      const mailtoUrl="mailto:"+email+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
      window.open(mailtoUrl);
      toast("Ouverture du client mail pour "+email,"s");
    }
    setSending(null);
  };

  const [expandedPartner,setExpandedPartner]=useState(null);

  return <div>
    <h2 style={{fontSize:19,fontWeight:800,marginBottom:4}}>Paiements</h2>
    <p style={{fontSize:12,color:"var(--tx3)",marginBottom:16}}>Suivi des paiements par partenaire — regroupement par périodes de 3 semaines</p>

    {/* ── Stats globales ── */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:11,marginBottom:20}}>
      {[
        {l:"Total encaissé",v:paid.reduce((s,d)=>s+(d.amount||0),0).toLocaleString("fr-FR")+" €",c:"var(--gr)",bg:"var(--gr-l)"},
        {l:"Total en attente",v:unpaid.reduce((s,d)=>s+(d.amount||0),0).toLocaleString("fr-FR")+" €",c:"var(--re)",bg:"var(--re-l)"},
        {l:"Dossiers payés",v:paid.length+"",c:"var(--gr)",bg:"var(--gr-l)"},
        {l:"Dossiers impayés",v:unpaid.length+"",c:"var(--re)",bg:"var(--re-l)"},
        {l:"Partenaires",v:partners.filter(p=>p.totalDue>0).length+"",c:"var(--or)",bg:"var(--or-l)"},
      ].map((s,i)=><div key={i} style={{padding:"14px 16px",borderRadius:"var(--rl)",background:s.bg,border:"1.5px solid "+s.c+"25"}}>
        <div style={{fontSize:20,fontWeight:800,color:s.c,marginBottom:2}}>{s.v}</div>
        <div style={{fontSize:11,color:s.c,fontWeight:600,opacity:.8}}>{s.l}</div>
      </div>)}
    </div>

    {/* ── Par partenaire : EN ATTENTE ── */}
    <div style={{marginBottom:24}}>
      <h3 style={{fontSize:15,fontWeight:800,color:"var(--re)",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
        <span style={{width:8,height:8,borderRadius:"50%",background:"var(--re)",display:"inline-block"}}/>
        Paiements en attente
      </h3>
      {partners.filter(p=>p.totalDue>0).length===0&&<div className="card" style={{textAlign:"center",padding:30,color:"var(--tx4)",fontSize:13}}>Aucun paiement en attente</div>}
      {partners.filter(p=>p.totalDue>0).map(p=>{
        const periods=groupByPeriod(p.unpaid);
        const isExpanded=expandedPartner===p.name;
        return <div key={p.name} className="card" style={{marginBottom:12,border:"1.5px solid var(--re)30",overflow:"hidden"}}>
          {/* Header partenaire */}
          <div style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer",padding:"2px 0"}} onClick={()=>setExpandedPartner(isExpanded?null:p.name)}>
            <div style={{width:40,height:40,borderRadius:11,background:"var(--re-l)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:"var(--re)",flexShrink:0}}>
              {p.name[0]}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:14}}>{p.name}</div>
              <div style={{fontSize:11,color:"var(--tx3)"}}>{p.unpaid.length} dossier{p.unpaid.length>1?"s":""} impayé{p.unpaid.length>1?"s":""}</div>
            </div>
            <div style={{textAlign:"right",marginRight:8}}>
              <div style={{fontWeight:800,fontSize:20,color:"var(--re)"}}>{p.totalDue.toLocaleString("fr-FR")} €</div>
              <div style={{fontSize:10,color:"var(--tx4)"}}>dû au total</div>
            </div>
            {isSA&&<button className="btn btn-sm" style={{background:"var(--or)",color:"#fff",border:"none",gap:5,flexShrink:0}} onClick={e=>{e.stopPropagation();sendPaymentLink(p);}} disabled={sending===p.name}>
              <Ic n="mail" s={11} c="#fff"/>{sending===p.name?"Envoi...":"Lien de paiement"}
            </button>}
            {isSA&&<button className="btn btn-sm" style={{background:"var(--gr)",color:"#fff",border:"none",gap:5,flexShrink:0}} onClick={e=>{e.stopPropagation();markAll(p.unpaid.map(d=>d.id));}}>
              <Ic n="check" s={11} c="#fff"/>Tout valider
            </button>}
            <span style={{fontSize:16,color:"var(--tx4)",transition:".2s",transform:isExpanded?"rotate(180deg)":"rotate(0)"}}>▾</span>
          </div>

          {/* Détail par période */}
          {isExpanded&&<div style={{marginTop:14,borderTop:"1.5px solid var(--bd)",paddingTop:12}}>
            {periods.map((period,pi)=><div key={pi} style={{marginBottom:pi<periods.length-1?14:0}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--or)",background:"var(--or-l)",padding:"4px 10px",borderRadius:6,display:"inline-block",marginBottom:8}}>
                {period.label} — {period.total.toLocaleString("fr-FR")} €
              </div>
              {period.dossiers.map(d=><div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",marginBottom:4,background:"var(--bg3)",borderRadius:"var(--r)",border:"1px solid var(--bd)"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.client}</div>
                  <div style={{fontSize:10,color:"var(--tx4)"}}>{d.id} · {d.client_org||"—"} · {new Date(d.created).toLocaleDateString("fr-FR")}</div>
                </div>
                <div style={{fontWeight:800,fontSize:14,color:"var(--re)",flexShrink:0}}>{(d.amount||0).toLocaleString("fr-FR")} €</div>
                {isSA&&<button className="btn btn-s btn-sm" style={{flexShrink:0}} onClick={()=>mark(d.id)}><Ic n="check" s={10}/>Valider</button>}
              </div>)}
            </div>)}
          </div>}
        </div>;
      })}
    </div>

    {/* ── Par partenaire : PAYÉS ── */}
    <div>
      <h3 style={{fontSize:15,fontWeight:800,color:"var(--gr)",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
        <span style={{width:8,height:8,borderRadius:"50%",background:"var(--gr)",display:"inline-block"}}/>
        Paiements encaissés
      </h3>
      {partners.filter(p=>p.totalPaid>0).length===0&&<div className="card" style={{textAlign:"center",padding:30,color:"var(--tx4)",fontSize:13}}>Aucun paiement encaissé</div>}
      {partners.filter(p=>p.totalPaid>0).map(p=><div key={p.name} className="card" style={{marginBottom:10,border:"1.5px solid var(--gr)25"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:"var(--gr-l)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,color:"var(--gr)",flexShrink:0}}>
            {p.name[0]}
          </div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:13}}>{p.name}</div>
            <div style={{fontSize:10,color:"var(--tx4)"}}>{p.paid.length} dossier{p.paid.length>1?"s":""}</div>
          </div>
          <div style={{fontWeight:800,fontSize:17,color:"var(--gr)"}}>{p.totalPaid.toLocaleString("fr-FR")} €</div>
          <span style={{color:"var(--gr)",fontSize:10,fontWeight:700,background:"var(--gr-l)",padding:"3px 10px",borderRadius:20,border:"1px solid rgba(34,197,94,.2)"}}>Payé</span>
        </div>
      </div>)}
    </div>
  </div>;
}

// ── IMPORT ──
function Import({setDossiers,toast}){
  const [preview,setPreview]=useState([]);const fRef=useRef();
  const handle=files=>{const file=files[0];if(!file)return;const r=new FileReader();r.onload=e=>{try{let rows=[];if(file.name.endsWith(".json"))rows=JSON.parse(e.target.result);else{const ls=e.target.result.trim().split("\n");const hs=ls[0].split(",").map(h=>h.trim().replace(/"/g,""));rows=ls.slice(1).map(l=>{const v=l.split(",").map(x=>x.trim().replace(/"/g,""));const o={};hs.forEach((h,i)=>o[h]=v[i]||"");return o;});}setPreview(rows.slice(0,5));toast(rows.length+" lignes detectees","i");}catch{toast("Erreur","e");}};r.readAsText(file);};
  const confirm=()=>{const now=new Date().toISOString().split("T")[0];const nd=preview.map((row,i)=>({id:genId(),client:row.client||row.nom||"Client "+(i+1),client_org:row.client_org||"",email:row.email||"",phone:row.phone||"",address:row.address||"",postal_code:"",dp_number:row.dp_number||"",parcelle:"",works:[{type:row.type_travaux||"ITE",formalites:[],kwc:""}],status:"nouveau",assignee:EMPLOYEES[0],paid:false,amount:Number(row.amount||0),installed:false,created:now,updated:now,docs:[],comments:[],avancement:{dp_checked:false,dp_envoi:"",dp_note:"",racc_checked:false,racc_date:"",racc_status:"",racc_note:"",cons_checked:false,cons_date:"",cons_note:"",tva_checked:false,tva_date:"",tva_note:""}}));setDossiers(p=>[...nd,...p]);setPreview([]);toast(nd.length+" importe(s)","s");};
  return <div>
    <h2 style={{fontSize:19,fontWeight:800,marginBottom:14}}>Import</h2>
    <div className="card" style={{marginBottom:12}}><code style={{display:"block",background:"var(--bg3)",padding:11,borderRadius:"var(--r)",fontSize:11,color:"var(--or)",border:"1.5px solid var(--bd)",fontFamily:"var(--fm)"}}>client,email,phone,address,dp_number,type_travaux,amount</code></div>
    <div style={{border:"2px dashed var(--bd2)",borderRadius:"var(--rl)",padding:28,textAlign:"center",cursor:"pointer",background:"var(--bg3)",marginBottom:14}} onClick={()=>fRef.current&&fRef.current.click()} onDragOver={e=>{e.preventDefault();}} onDrop={e=>{e.preventDefault();handle(e.dataTransfer.files);}}>
      <Ic n="import" s={28} c="var(--or)"/><p style={{fontSize:13,fontWeight:700,marginTop:9}}>CSV ou JSON</p>
    </div>
    <input ref={fRef} type="file" accept=".csv,.json" style={{display:"none"}} onChange={e=>handle(e.target.files)}/>
    {preview.length>0&&<div className="card"><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><h3 style={{fontSize:12,fontWeight:700}}>Apercu</h3><button className="btn btn-p btn-sm" onClick={confirm}><Ic n="check" s={11}/>Confirmer</button></div><div style={{overflowX:"auto"}}><table><thead><tr>{Object.keys(preview[0]).map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{preview.map((row,i)=><tr key={i}>{Object.values(row).map((v,j)=><td key={j}>{v||"—"}</td>)}</tr>)}</tbody></table></div></div>}
  </div>;
}

// ── PROFIL ──
function Profil({currentUser,users,setUsers,toast}){
  const u=users.find(x=>x.id===currentUser.id)||currentUser;
  const [name,setName]=useState(u.name);const [pwd,setPwd]=useState("");const avRef=useRef();
  const [smtpPwd,setSmtpPwd]=useState("");const [smtpSaving,setSmtpSaving]=useState(false);
  const handleAv=file=>{if(!file)return;const r=new FileReader();r.onload=e=>{setUsers(p=>p.map(x=>x.id===currentUser.id?{...x,avatar:e.target.result}:x));toast("Photo mise a jour","s");};r.readAsDataURL(file);};
  const saveSmtp=async()=>{
    if(!smtpPwd.trim()){toast("Saisis ton mot de passe d'application","e");return;}
    setSmtpSaving(true);
    try{await updateUserSmtp(currentUser.id,smtpPwd);setUsers(p=>p.map(x=>x.id===currentUser.id?{...x,smtp_configured:1}:x));toast("SMTP configuré — les emails partiront de "+u.email,"s");setSmtpPwd("");}
    catch(e){toast("Erreur: "+e.message,"e");}
    finally{setSmtpSaving(false);}
  };
  const isGmail=(u.email||"").includes("@gmail.");
  const isOutlook=/(@outlook\.|@hotmail\.|@live\.)/.test(u.email||"");
  const smtpHelp=isGmail?"Google → Sécurité → Mots de passe d'application → Générer":isOutlook?"Microsoft → Sécurité → Mots de passe d'application → Créer":"Crée un mot de passe d'application depuis ton fournisseur email";
  return <div style={{maxWidth:460}}>
    <h2 style={{fontSize:19,fontWeight:800,marginBottom:18}}>Mon profil</h2>
    <div className="card" style={{marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
        <div style={{position:"relative"}}>
          <div className="av" style={{width:68,height:68,fontSize:22}}>{u.avatar?<img src={u.avatar} alt="av"/>:u.initials}</div>
          <button style={{position:"absolute",bottom:-3,right:-3,width:24,height:24,borderRadius:"50%",background:"var(--or)",border:"2px solid var(--bg2)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}} onClick={()=>avRef.current&&avRef.current.click()}><Ic n="cam" s={11} c="#fff"/></button>
          <input ref={avRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleAv(e.target.files?.[0])}/>
        </div>
        <div><div style={{fontWeight:700,fontSize:15}}>{u.name}</div><div style={{fontSize:11,color:"var(--tx3)"}}>{u.email}</div><span style={{background:"var(--or-l)",color:"var(--or)",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,marginTop:4,display:"inline-block"}}>{u.role}</span></div>
      </div>
      <div className="fg" style={{marginBottom:11}}><label className="lbl">Nom</label><input value={name} onChange={e=>setName(e.target.value)}/></div>
      <button className="btn btn-p btn-sm" onClick={()=>{setUsers(p=>p.map(x=>x.id===currentUser.id?{...x,name}:x));toast("Nom mis a jour","s");}}><Ic n="check" s={11}/>Sauvegarder</button>
    </div>
    <div className="card" style={{marginBottom:12}}><h3 style={{fontSize:12,fontWeight:700,marginBottom:12}}>Mot de passe</h3>
      <div className="fg" style={{marginBottom:11}}><label className="lbl">Nouveau</label><input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="••••••••"/></div>
      <button className="btn btn-s btn-sm" onClick={()=>{setPwd("");toast("Mot de passe mis a jour","s");}}><Ic n="lock" s={11}/>Mettre a jour</button>
    </div>
    <div className="card" style={{border:u.smtp_configured?"2px solid #22c55e":"2px solid #f59e0b"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
        <Ic n="mail" s={14}/>
        <h3 style={{fontSize:12,fontWeight:700,margin:0}}>Configuration email SMTP</h3>
        {u.smtp_configured?<span style={{background:"#dcfce7",color:"#16a34a",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>Configuré</span>
        :<span style={{background:"#fef3c7",color:"#b45309",padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700}}>Non configuré</span>}
      </div>
      <p style={{fontSize:11,color:"var(--tx3)",margin:"0 0 8px",lineHeight:1.5}}>
        Les relances et emails partiront de <strong>{u.email}</strong>.<br/>
        {smtpHelp}
      </p>
      <div className="fg" style={{marginBottom:11}}>
        <label className="lbl">Mot de passe d'application</label>
        <input type="password" value={smtpPwd} onChange={e=>setSmtpPwd(e.target.value)} placeholder={u.smtp_configured?"••••••••  (déjà configuré, re-saisir pour modifier)":"Colle ton mot de passe d'application ici"}/>
      </div>
      <button className="btn btn-p btn-sm" disabled={smtpSaving} onClick={saveSmtp}><Ic n="check" s={11}/>{smtpSaving?"Enregistrement...":"Enregistrer"}</button>
    </div>
  </div>;
}

// ── ADMIN ──
function Admin({users,setUsers,toast}){
  const [showForm,setShowForm]=useState(false);
  const [nName,setNName]=useState("");const [nEmail,setNEmail]=useState("");const [nPwd,setNPwd]=useState("");const [nRole,setNRole]=useState("employee");
  const [delConfirm,setDelConfirm]=useState(null);

  const roleColors={superadmin:{bg:"#fffbeb",color:"#b45309",border:"#fcd34d"},admin:{bg:"var(--or-l)",color:"var(--or)",border:"rgba(232,80,26,.2)"},employee:{bg:"var(--bl-l,#e0f2fe)",color:"var(--bl,#0284c7)",border:"rgba(2,132,199,.2)"},client:{bg:"var(--gr-l)",color:"var(--gr)",border:"rgba(34,197,94,.2)"},partenaire:{bg:"var(--pu-l)",color:"var(--pu)",border:"rgba(107,53,200,.2)"}};
  const rc=r=>roleColors[r]||roleColors.employee;

  const addUser=async()=>{
    if(!nName.trim()||!nEmail.trim()||!nPwd.trim()){toast("Remplissez tous les champs","e");return;}
    if(users.find(u=>u.email===nEmail.trim())){toast("Cet email existe deja","e");return;}
    const initials=nName.trim().split(/\s+/).map(w=>w[0]).join("").toUpperCase().slice(0,2);
    try{
      const res=await fetch((import.meta.env.VITE_API_URL||'http://localhost:3001/api')+'/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:nName.trim(),email:nEmail.trim(),password:nPwd.trim(),role:nRole,initials})});
      const data=await res.json();
      if(!res.ok){toast(data.error||"Erreur","e");return;}
      setUsers(p=>[...p,{id:data.user.id,name:nName.trim(),email:nEmail.trim(),role:nRole,initials,avatar:null}]);
      setNName("");setNEmail("");setNPwd("");setNRole("employee");setShowForm(false);
      toast("Utilisateur "+nName.trim()+" cree avec succes","s");
    }catch(e){toast("Erreur réseau : "+e.message,"e");}
  };

  const removeUser=id=>{
    setUsers(p=>p.filter(u=>u.id!==id));
    setDelConfirm(null);
    toast("Utilisateur supprime","s");
  };

  return <div>
    <h2 style={{fontSize:19,fontWeight:800,marginBottom:18}}>Administration</h2>
    <div className="card" style={{marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <h3 style={{fontSize:12,fontWeight:800,margin:0}}>Utilisateurs ({users.length})</h3>
        <button className="btn btn-p btn-sm" onClick={()=>setShowForm(v=>!v)}><Ic n={showForm?"x":"plus"} s={11}/>{showForm?"Annuler":"Nouvel utilisateur"}</button>
      </div>

      {showForm&&<div style={{padding:14,background:"var(--bg3)",borderRadius:"var(--r)",border:"1.5px solid var(--bd)",marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Creer un utilisateur</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div className="fg"><label className="lbl">Nom</label><input value={nName} onChange={e=>setNName(e.target.value)} placeholder="Jean Dupont"/></div>
          <div className="fg"><label className="lbl">Email</label><input type="email" value={nEmail} onChange={e=>setNEmail(e.target.value)} placeholder="jean@email.fr"/></div>
          <div className="fg"><label className="lbl">Mot de passe</label><input type="password" value={nPwd} onChange={e=>setNPwd(e.target.value)} placeholder="••••••••"/></div>
          <div className="fg"><label className="lbl">Role</label><select value={nRole} onChange={e=>setNRole(e.target.value)}>
            <option value="employee">Employe</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Super Admin</option>
            <option value="partenaire">Partenaire externe</option>
            <option value="client">Client</option>
          </select></div>
        </div>
        {nRole==="client"&&<div style={{padding:9,background:"var(--gr-l)",borderRadius:"var(--r)",fontSize:11,color:"var(--gr)",marginBottom:10,border:"1px solid rgba(34,197,94,.2)"}}>
          <strong>Profil Client :</strong> Ce compte ne verra que les dossiers associes a son email. Navigation restreinte (Dossiers, Documents, Profil).
        </div>}
        {nRole==="partenaire"&&<div style={{padding:9,background:"var(--pu-l)",borderRadius:"var(--r)",fontSize:11,color:"var(--pu)",marginBottom:10,border:"1px solid rgba(107,53,200,.2)"}}>
          <strong>Profil Partenaire :</strong> Ce compte ne verra que les dossiers qu'il a crees. Acces restreint : Mes dossiers + Chat. Aucun acces a la GED, emails ou administration.
        </div>}
        <button className="btn btn-p btn-sm" onClick={addUser}><Ic n="check" s={11}/>Creer le compte</button>
      </div>}

      {users.map(u=><div key={u.id} style={{display:"flex",alignItems:"center",gap:11,marginBottom:8,padding:"10px 12px",background:"var(--bg3)",borderRadius:"var(--r)",border:"1.5px solid var(--bd)"}}>
        <div className="av">{u.avatar?<img src={u.avatar} alt=""/>:u.initials}</div>
        <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13}}>{u.name}</div><div style={{fontSize:10,color:"var(--tx4)"}}>{u.email}</div></div>
        <span style={{padding:"2px 9px",borderRadius:20,fontSize:10,fontWeight:700,background:rc(u.role).bg,color:rc(u.role).color,border:"1px solid "+rc(u.role).border}}>{u.role}</span>
        {delConfirm===u.id?<div style={{display:"flex",gap:4}}>
          <button className="btn btn-sm" style={{background:"var(--re)",color:"#fff",border:"none",fontSize:10,padding:"3px 8px"}} onClick={()=>removeUser(u.id)}>Oui</button>
          <button className="btn btn-s btn-sm" style={{fontSize:10,padding:"3px 8px"}} onClick={()=>setDelConfirm(null)}>Non</button>
        </div>:<button className="bic" style={{opacity:.4}} onClick={()=>setDelConfirm(u.id)} title="Supprimer"><Ic n="x" s={12}/></button>}
      </div>)}
    </div>
    <div className="card">
      <h3 style={{fontSize:12,fontWeight:800,marginBottom:12}}>Securite</h3>
      {[["2FA","Tous les comptes"],["Tokens clients","Acces securises"],["HTTPS","Chiffrement TLS"]].map(([t,d])=><div key={t} style={{display:"flex",gap:10,alignItems:"center",marginBottom:8,padding:"9px 11px",background:"var(--bg3)",borderRadius:"var(--r)",border:"1.5px solid var(--bd)"}}>
        <Ic n="lock" s={14} c="var(--gr)"/>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{t}</div><div style={{fontSize:10,color:"var(--tx4)"}}>{d}</div></div>
        <span style={{color:"var(--gr)",fontSize:10,fontWeight:700,background:"var(--gr-l)",padding:"2px 7px",borderRadius:20}}>Actif</span>
      </div>)}
    </div>
  </div>;
}

// ── NOTIF PANEL ──
function NotifPanel({notifs,onClose,onClear}){
  return <div style={{position:"fixed",top:56,right:0,width:320,background:"var(--bg2)",border:"1.5px solid var(--bd)",borderRadius:"0 0 14px 14px",boxShadow:"var(--shl)",maxHeight:480,overflow:"hidden",display:"flex",flexDirection:"column",zIndex:150}}>
    <div style={{padding:"12px 14px",borderBottom:"1.5px solid var(--bd)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <span style={{fontWeight:800,fontSize:13}}>Notifications</span>
      <div style={{display:"flex",gap:7}}><button className="btn btn-s btn-sm" onClick={onClear}>Tout lire</button><button className="bic" onClick={onClose}><Ic n="x" s={12}/></button></div>
    </div>
    <div style={{overflowY:"auto",flex:1}}>
      {!notifs.length&&<p style={{padding:18,color:"var(--tx4)",fontSize:12,textAlign:"center"}}>Aucune notification</p>}
      {notifs.map((n,i)=><div key={i} className={"ntfit"+(n.unread?" unread":"")}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>{n.type==="comment"?"💬":n.type==="doc"?"📎":"🔔"}</span>
          <div><div style={{fontSize:12,fontWeight:n.unread?700:500}}>{n.msg}</div><div style={{fontSize:10,color:"var(--tx4)",marginTop:1}}>{n.date?.split("T")[0]||""}</div></div>
        </div>
      </div>)}
    </div>
  </div>;
}

// ── APP ROOT ──
function InstallBanner({installEvt,isIos,onClose}){
  const doInstall=async()=>{if(installEvt){installEvt.prompt();const r=await installEvt.userChoice;if(r.outcome==='accepted')onClose();}};
  const isMobile=/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
  return <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:99999,background:'var(--bg2)',borderTop:'3px solid var(--or)',boxShadow:'0 -4px 20px rgba(0,0,0,.15)',padding:'16px 20px',display:'flex',alignItems:'center',gap:14,fontFamily:'var(--ff)'}}>
    <div style={{width:44,height:44,borderRadius:12,background:'var(--or)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L12 15M12 15L8 11M12 15L16 11" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 17V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V17" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </div>
    <div style={{flex:1}}>
      <div style={{fontWeight:700,fontSize:14,color:'var(--tx)',marginBottom:2}}>Installer Eco-CRM {isMobile?'sur votre téléphone':'sur votre ordinateur'}</div>
      {isIos
        ?<div style={{fontSize:12,color:'var(--tx3)'}}>Appuyez sur <strong>Partager</strong> <span style={{fontSize:16}}>⎋</span> puis <strong>"Sur l'écran d'accueil"</strong></div>
        :<div style={{fontSize:12,color:'var(--tx3)'}}>Accédez à l'app en un clic, même hors connexion</div>
      }
    </div>
    {!isIos&&<button onClick={doInstall} style={{padding:'8px 18px',background:'var(--or)',color:'#fff',border:'none',borderRadius:8,fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'var(--ff)',whiteSpace:'nowrap'}}>Installer</button>}
    <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'var(--tx4)',padding:4}} title="Fermer">✕</button>
  </div>;
}

export default function App(){
  const [user,setUser]=useState(()=>{try{const token=getToken();const saved=localStorage.getItem('auth_user');if(token&&saved)return JSON.parse(saved);}catch{}return null;});
  const [users,setUsers]=useState(INIT_USERS);
  const [page,setPage]=useState("dashboard");
  const [dossiers,setDossiers]=useState(MOCK);
  const [toasts,setToasts]=useState([]);
  const [dark,setDark]=useState(false);
  const [sbOpen,setSbOpen]=useState(false);
  const [notifs,setNotifs]=useState([]);
  const [showNotifs,setShowNotifs]=useState(false);
  const [globalQ,setGlobalQ]=useState("");
  const [globalFilters,setGlobalFilters]=useState({status:"",assignee:"",work:"",formalite:"",client_name:"",date_created:"",date_updated:""});
  const [clientsOrg,setClientsOrg]=useState(INIT_CLIENTS_ORG);
  const [installEvt,setInstallEvt]=useState(null);
  const [showInstallBanner,setShowInstallBanner]=useState(false);
  const [isIos,setIsIos]=useState(false);
  const [isStandalone,setIsStandalone]=useState(false);

  useEffect(()=>{
    const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone;
    setIsStandalone(!!standalone);
    const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)&&!window.MSStream;
    setIsIos(ios);
    if(ios&&!standalone){setTimeout(()=>setShowInstallBanner(true),3000);}
    const handler=(e)=>{e.preventDefault();setInstallEvt(e);setShowInstallBanner(true);};
    window.addEventListener('beforeinstallprompt',handler);
    return ()=>window.removeEventListener('beforeinstallprompt',handler);
  },[]);

  const toggleDark=()=>setDark(d=>{const next=!d;document.documentElement.setAttribute("data-theme",next?"dark":"light");return next;});
  const toast=(msg,type="i")=>{const id=Date.now()+Math.random();setToasts(t=>[...t,{id,msg,type}]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4000);};
  const rmToast=id=>setToasts(t=>t.filter(x=>x.id!==id));
  const addNotif=n=>setNotifs(p=>[{...n,unread:true},...p]);
  const unread=notifs.filter(n=>n.unread).length;
  const topXlsRef=useRef();
  const topExportXLS=async()=>{
    const XLSX=await loadXLSX();
    const rows=dossiers.map(dossierToRow);
    const ws=XLSX.utils.json_to_sheet(rows);
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Dossiers");
    const date=new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb,`SolarCRM_Export_${date}.xlsx`);
    toast("Export Excel telecharge ("+dossiers.length+" dossiers)","s");
  };
  const topImportXLS=async(file)=>{
    const XLSX=await loadXLSX();
    const buf=await file.arrayBuffer();const wb=XLSX.read(buf);const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws);
    if(!rows.length){toast("Fichier vide ou format incorrect","e");return;}
    const imported=rows.map(rowToDossier).filter(d=>d.client);
    if(!imported.length){toast("Aucun dossier valide trouvé","e");return;}
    setDossiers(prev=>{const ids=new Set(prev.map(d=>d.id));const news=imported.filter(d=>!ids.has(d.id));return[...prev.map(d=>{const up=imported.find(i=>i.id===d.id);return up?{...d,...up}:d;}),...news];});
    toast(imported.length+" dossier(s) importé(s)","s");
  };

  if(!user)return <><style>{CSS}</style><Login onLogin={u=>{localStorage.setItem('auth_user',JSON.stringify(u));setUser(u);setPage((u.role==="client"||u.role==="partenaire")?"dossiers":"dashboard");}}/><Toasts ts={toasts} rm={rmToast}/></>;

  const isSA=user.role==="superadmin";
  const isClient=user.role==="client";
  const isPartner=user.role==="partenaire";
  const curUser=users.find(u2=>u2.id===user.id)||user;

  const navItems=isPartner?[
    {id:"dossiers",icon:"folder",label:"Mes dossiers",badge:dossiers.length},
    {id:"profil",icon:"cam",label:"Mon profil"},
  ]:isClient?[
    {id:"dossiers",icon:"folder",label:"Mes dossiers"},
    {id:"ged",icon:"file",label:"Documents"},
    {id:"profil",icon:"cam",label:"Mon profil"},
  ]:[
    {id:"dashboard",icon:"bar",label:"Dashboard"},
    {id:"dossiers",icon:"folder",label:"Dossiers",badge:dossiers.filter(d=>!d.assignee).length},
    {id:"clients",icon:"users",label:"Partenaires",badge:clientsOrg.length},
    ...(isSA?[{id:"paiements",icon:"credit",label:"Paiements",badge:dossiers.filter(d=>!d.paid).length}]:[]),
    {id:"ged",icon:"file",label:"GED"},
    {id:"emails",icon:"mail",label:"Emails"},
    {id:"import",icon:"import",label:"Import"},
    {id:"profil",icon:"cam",label:"Mon profil"},
    ...(isSA?[{id:"admin",icon:"settings",label:"Administration"}]:[]),
  ];

  const titles={dashboard:"Tableau de bord",dossiers:"Dossiers",clients:"Partenaires",paiements:"Paiements",ged:"GED — Documents",emails:"Emails",import:"Import",profil:"Mon profil",admin:"Administration"};

  const setFilter=(k,v)=>{setGlobalFilters(f=>({...f,[k]:f[k]===v?"":v}));if(page!=="dossiers")setPage("dossiers");};
  const hasFilter=Object.values(globalFilters).some(Boolean);

  // Client/Partenaire : filtrage des dossiers visibles
  const visibleDossiers=isPartner?dossiers.filter(d=>d.created_by===user.id):isClient?dossiers.filter(d=>d.email===user.email):dossiers;

  const pages={
    dashboard:<Dashboard dossiers={visibleDossiers}/>,
    dossiers:<Dossiers dossiers={visibleDossiers} setDossiers={setDossiers} currentUser={user} toast={toast} addNotif={addNotif} globalQ={globalQ} globalFilters={globalFilters} clientsOrg={clientsOrg} setClientsOrg={setClientsOrg}/>,
    clients:<Clients dossiers={visibleDossiers} clientsOrg={clientsOrg} setClientsOrg={setClientsOrg} toast={toast}/>,
    paiements:<Paiements dossiers={visibleDossiers} setDossiers={setDossiers} currentUser={user} toast={toast} clientsOrg={clientsOrg} users={users}/>,
    ged:<div className="content"><GEDModule dossiers={visibleDossiers} onDossierUpdate={(id,data)=>{setDossiers(ds=>ds.map(d=>{if(d.id!==id)return d;const nd={...d,...(data.dp_number?{dp_number:data.dp_number}:{})};if(data.dp_number)nd.id=dossierId(data.dp_number,d.id);return nd;}));}}/></div>,
    emails:<EmailModule dossiers={visibleDossiers}/>,
    import:<Import setDossiers={setDossiers} toast={toast}/>,
    profil:<Profil currentUser={user} users={users} setUsers={setUsers} toast={toast}/>,
    admin:<Admin users={users} setUsers={setUsers} toast={toast}/>,
  };

  return <>
    <style>{CSS}</style>
    <div className="app">
      {sbOpen&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:99}} onClick={()=>setSbOpen(false)}/>}

      {/* ── SIDEBAR ── */}
      <div className={"sb"+(sbOpen?" open":"")}>
        <div className="sb-logo"><img src={LOGO_SRC} alt="Eco Formalites"/></div>
        {/* Search — prominent at top (hidden for partners) */}
        {!isPartner&&<div className="sb-srch">
          <span className="sb-srch-ic"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
          <input value={globalQ} onChange={e=>{setGlobalQ(e.target.value);if(e.target.value&&page!=="dossiers")setPage("dossiers");}} placeholder="Nom, CP, adresse, N° DP..."/>
        </div>}
        <div className="sb-nav">
          <div className="nvsec">Navigation</div>
          {navItems.map(item=><div key={item.id} className={"nvi"+(page===item.id?" act":"")} onClick={()=>{setPage(item.id);setSbOpen(false);}}>
            <Ic n={item.icon} s={15} c={page===item.id?"#fff":"rgba(255,255,255,.7)"}/>
            <span style={{flex:1}}>{item.label}</span>
            {item.badge>0&&<span className="nvbdg">{item.badge}</span>}
          </div>)}
        </div>
        <div className="sb-usr">
          <div className="av" style={{fontSize:10}}>{curUser.avatar?<img src={curUser.avatar} alt=""/>:curUser.initials}</div>
          <div style={{flex:1,minWidth:0}}><div className="unm" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{curUser.name}</div><div className="uro">{curUser.role}</div></div>
          <button style={{background:"none",border:"none",cursor:"pointer",padding:5,color:"rgba(255,255,255,.4)",display:"flex",borderRadius:5,transition:".15s"}} onClick={()=>{apiLogout();setUser(null);}}><Ic n="logout" s={14} c="rgba(255,255,255,.5)"/></button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div className="main">
        <div className="topbar">
          <button className="bic" style={{display:"none"}} onClick={()=>setSbOpen(o=>!o)}><Ic n="menu" c="var(--tx2)"/></button>
          {/*<div className="tb-ttl">{titles[page]||"CRM"}</div>*/}

          {/* Filters — compact, left-aligned (hidden for clients) */}
          {!isClient&&!isPartner&&<div className="tb-flt">
            <input className={"fsel"+(globalFilters.client_name?" on":"")}
              value={globalFilters.client_name}
              onChange={e=>{setGlobalFilters(f=>({...f,client_name:e.target.value}));if(e.target.value&&page!=="dossiers")setPage("dossiers");}}
              placeholder="Partenaire..."
              style={{width:100}}/>
            <select className={"fsel"+(globalFilters.status?" on":"")} value={globalFilters.status} onChange={e=>setFilter("status",e.target.value)}>
              <option value="">Statut</option>{ALL_STATUSES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select className={"fsel"+(globalFilters.assignee?" on":"")} value={globalFilters.assignee} onChange={e=>setFilter("assignee",e.target.value)}>
              <option value="">Resp.</option>{EMPLOYEES.map(e=><option key={e}>{e}</option>)}
            </select>
            <select className={"fsel"+(globalFilters.work?" on":"")} value={globalFilters.work} onChange={e=>setFilter("work",e.target.value)}>
              <option value="">Travaux</option>{WORK_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
            <select className={"fsel"+(globalFilters.formalite?" on":"")} value={globalFilters.formalite} onChange={e=>setFilter("formalite",e.target.value)}>
              <option value="">Formalité</option>{FORMALITES.map(f=><option key={f}>{f}</option>)}
            </select>
            <input type="date" title="Créé depuis"
              className={"fsel"+(globalFilters.date_created?" on":"")}
              value={globalFilters.date_created}
              onChange={e=>{setGlobalFilters(f=>({...f,date_created:e.target.value}));if(e.target.value&&page!=="dossiers")setPage("dossiers");}}
              style={{width:120}}/>
            <input type="date" title="Modifié depuis"
              className={"fsel"+(globalFilters.date_updated?" on":"")}
              value={globalFilters.date_updated}
              onChange={e=>{setGlobalFilters(f=>({...f,date_updated:e.target.value}));if(e.target.value&&page!=="dossiers")setPage("dossiers");}}
              style={{width:120}}/>
            {hasFilter&&<button className="btn btn-d btn-sm" onClick={()=>setGlobalFilters({status:"",assignee:"",work:"",formalite:"",client_name:"",date_created:"",date_updated:""})}><Ic n="x" s={11}/>Réinitialiser</button>}
          </div>}

          {!isClient&&!isPartner&&<><input ref={topXlsRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={e=>{if(e.target.files?.[0])topImportXLS(e.target.files[0]);e.target.value="";}}/>
          <button className="btn btn-s btn-sm tb-xls" onClick={()=>topXlsRef.current?.click()} style={{marginLeft:"auto"}}><Ic n="import" s={12} c="var(--gr)"/>Importer</button>
          <button className="btn btn-s btn-sm tb-xls" onClick={topExportXLS}><Ic n="dl" s={12} c="var(--bl)"/>Exporter</button></>}
          <button className="dtog" onClick={toggleDark} title={dark?"Clair":"Sombre"}>{dark?"☀️":"🌙"}</button>

          {/* Notifications */}
          <div style={{position:"relative"}}>
            <button className="bic" onClick={()=>setShowNotifs(v=>!v)}>
              <Ic n="bell" s={15} c="var(--tx3)"/>
              {unread>0&&<span className="ntfdot"/>}
            </button>
            {showNotifs&&<NotifPanel notifs={notifs} onClose={()=>setShowNotifs(false)} onClear={()=>{setNotifs(p=>p.map(n=>({...n,unread:false})));setShowNotifs(false);}}/>}
          </div>

          <div className="av" style={{width:30,height:30,fontSize:10,cursor:"pointer"}} onClick={()=>setPage("profil")}>
            {curUser.avatar?<img src={curUser.avatar} alt=""/>:curUser.initials}
          </div>
        </div>

        <div className="content">{pages[page]||pages.dashboard}</div>
      </div>
    </div>
    <Toasts ts={toasts} rm={rmToast}/>
    <ChatBubble currentUser={user} dossiers={dossiers} users={users}/>
    {showInstallBanner&&!isStandalone&&<InstallBanner installEvt={installEvt} isIos={isIos} onClose={()=>{setShowInstallBanner(false);setInstallEvt(null);}}/>}
  </>;
}