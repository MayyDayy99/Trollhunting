/* ===================== Troll AI (típus-függő) ===================== */
// MOZGÁS: troll-vs-troll szétválás — ne torlódjanak/csússzanak egymásba (a "beszorulás" fő oka). Csak LOKÁLIS trollokra (co-opban a szerver végzi).
function separateMonsters(){
  for(let i=0;i<monsters.length;i++){ const a=monsters[i]; if(!a.alive||a.dying>0||coopIsRemote(a)) continue; const ar=(a.bodyR||0.5)*0.7;
    for(let j=i+1;j<monsters.length;j++){ const b=monsters[j]; if(!b.alive||b.dying>0||coopIsRemote(b)) continue; const br=(b.bodyR||0.5)*0.7;
      const ax=a.g.position, bx=b.g.position, dx=bx.x-ax.x, dz=bx.z-ax.z, minD=ar+br, d2=dx*dx+dz*dz;
      if(d2<minD*minD && d2>1e-6){ const d=Math.sqrt(d2), push=(minD-d), nx=dx/d, nz=dz/d;
        const aFix=(a.frozenSolid>0), bFix=(b.frozenSolid>0); if(aFix&&bFix) continue;   // a befagyott troll horgony
        if(aFix){ bx.x+=nx*push; bx.z+=nz*push; }
        else if(bFix){ ax.x-=nx*push; ax.z-=nz*push; }
        else { const h=push*0.5; ax.x-=nx*h; ax.z-=nz*h; bx.x+=nx*h; bx.z+=nz*h; } }
    }
  }
}
// ===== TÁMADÁS-PÓZOK: per-típus 3-fázisú (windup -> strike -> recovery) ABSZOLÚT póz az u(0..1) alapján; a lunge-ot a hívó adja =====
function motionRig(m){
  if(m._motion) return m._motion;
  const nodes=[m.pelvis,m.torso,m.head,m.jaw,m.arms.L,m.arms.R,m.elbows.L,m.elbows.R,
    m.fists.L,m.fists.R,m.legs.L,m.legs.R,m.knees.L,m.knees.R,m.ankles.L,m.ankles.R];
  // Demo clips own their root. A detached root keeps AI/network coordinates authoritative.
  const rig=Object.assign({},m.gen,{g:new THREE.Object3D(),genome:Object.assign({},m.genome)});
  const pose=new Float64Array(nodes.length*6);
  for(let i=0;i<nodes.length;i++){ const n=nodes[i], j=i*6;
    pose[j]=n.rotation.x; pose[j+1]=n.rotation.y; pose[j+2]=n.rotation.z;
    pose[j+3]=n.position.x; pose[j+4]=n.position.y; pose[j+5]=n.position.z; }
  return m._motion={rig,nodes,pose,idle:new Float64Array(pose.length),phase:m.walkPhase||0,
    time:(m.seed||0)%97,weight:0,x:m.g.position.x,z:m.g.position.z,hp:m.hp,hit:0,hf:-1,hl:0,
    yaw:m.g.rotation.y||0,bank:0,lookY:0,spr:{hy:{x:0,v:0},hx:{x:0,v:0},jaw:{x:0,v:0},wz:{x:0,v:0}}};
}
function _stepSpr(st, target, k, damp, dt){
  const c=2*damp*Math.sqrt(k);
  st.v+=(target-st.x)*k*dt - st.v*c*dt;
  st.x+=st.v*dt;
  return st.x;
}
function animateMonster(m,dt){
  if(!m.gen || dt<=0 || m.spawnArc!=null) return;
  const s=motionRig(m), p=m.g.position, A=TrollGen.anim, dtS=Math.min(0.05,dt);
  m.g.scale.setScalar(m.scale);
  if(m.hp<s.hp){ s.hit=Math.min(0.7,(s.hp-m.hp)/m.maxHp*3+0.12);
    // IRÁNYÍTOTT megrándulás: nyíl-találatnál a lövés irányába csavarodik/dől a törzs (DoT / zóna sebzésnél marad a sima hátrahőkölés)
    if(m._hitK>0){ const sy=Math.sin(m.g.rotation.y||0), cy=Math.cos(m.g.rotation.y||0);
      s.hf=clamp((m._hitX*sy+m._hitZ*cy)*m._hitK,-1.5,1.5); s.hl=clamp((m._hitX*cy-m._hitZ*sy)*m._hitK,-1.5,1.5); m._hitK=0; }
    else { s.hf=-1; s.hl=0; } }
  s.hp=m.hp;
  if(m._club && m._weaponRest) m._club.rotation.copy(m._weaponRest);
  if(m.frozenSolid>0 || (m.rooted>0 && !(m.atkPhase>0 && m.atkHit) && !(m.bossState && m.bossState.kind==='recover'))){
    for(let i=0;i<s.nodes.length;i++){ const n=s.nodes[i], j=i*6;
      n.rotation.set(s.pose[j],s.pose[j+1],s.pose[j+2]);
      n.position.set(s.pose[j+3],s.pose[j+4],s.pose[j+5]); }
    s.x=p.x; s.z=p.z; s.yaw=m.g.rotation.y||0; s.hit=0; return;
  }
  s.time+=dt;
  const dx=p.x-s.x, dz=p.z-s.z;
  const distance=Math.min(Math.hypot(dx,dz),Math.max(0.1,m.speed*dt*4));
  const forward=dx*Math.sin(m.g.rotation.y)+dz*Math.cos(m.g.rotation.y);
  const lateral=dx*Math.cos(m.g.rotation.y)-dz*Math.sin(m.g.rotation.y);
  let dYaw=(m.g.rotation.y||0)-s.yaw; dYaw=Math.atan2(Math.sin(dYaw),Math.cos(dYaw)); s.yaw=m.g.rotation.y||0;
  s.weight=lerp(s.weight,distance>dt*0.08 && !m.atkPhase?1:0,1-Math.exp(-dt*12));
  s.phase+=(forward<0?-1:1)*distance*3.1/Math.max(0.6,m.scale);
  s.x=p.x; s.z=p.z;
  const bankTarget=clamp(-(dYaw/Math.max(1e-4,dtS))*0.032 - (lateral/Math.max(0.25,dtS*m.speed))*0.085, -0.24, 0.24)*s.weight;
  s.bank=lerp(s.bank, bankTarget, 1-Math.exp(-dt*10));
  s.lookY=lerp(s.lookY, clamp(m._lookYaw||0,-0.68,0.68), 1-Math.exp(-dt*10));
  for(const n of s.nodes) n.rotation.set(0,0,0);
  A.idle(s.rig,s.time);
  for(let i=0;i<s.nodes.length;i++){ const n=s.nodes[i], j=i*6;
    s.idle[j]=n.rotation.x; s.idle[j+1]=n.rotation.y; s.idle[j+2]=n.rotation.z;
    s.idle[j+3]=n.position.x; s.idle[j+4]=n.position.y; s.idle[j+5]=n.position.z; }
  if(m.atkPhase>0 && m.atkKind){
    const heavy=m.genome.caste==='brute' || ['maul','trunk','boulder'].includes(m.genome.weapon);
    const hit=ATK_HITFRAC[m.atkKind]||0.5, clipHit=(heavy?0.60:0.53)+0.125;
    const u=Math.max(m.atkPhase,Math.min(1,m.atkT/(m.atkDur||1)));
    const clipU=u<=hit?u/hit*clipHit:clipHit+(u-hit)/(1-hit)*(1-clipHit);
    s.rig.genome.atk=({bruteSlam:'slam',scoutClaw:'claw',shardJab:'thrust',wispBite:'bite'})[m.atkKind]||m.genome.atk;
    A.attack(s.rig,clipU);
  } else {
    const speedK=clamp(distance/Math.max(1e-6,dt*m.speed),0.25,2.2);
    A.walk(s.rig,s.phase/(4+3*speedK),speedK);
    for(let i=0;i<s.nodes.length;i++){ const n=s.nodes[i], j=i*6, w=s.weight;
      n.rotation.set(lerp(s.idle[j],n.rotation.x,w),lerp(s.idle[j+1],n.rotation.y,w),lerp(s.idle[j+2],n.rotation.z,w));
      n.position.set(lerp(s.idle[j+3],n.position.x,w),lerp(s.idle[j+4],n.position.y,w),lerp(s.idle[j+5],n.position.z,w)); }
    // Kanyarodási/oldalazási bedőlés + tekintet-követés (egyenes járásnál 0 -> determinisztikus teszt-invariáns)
    if(Math.abs(s.bank)>1e-5){
      m.pelvis.rotation.z+=s.bank*0.5; m.torso.rotation.z+=s.bank*0.65;
      m.legs.L.rotation.z+=s.bank*0.32; m.legs.R.rotation.z+=s.bank*0.32;
    }
    if(Math.abs(s.lookY)>1e-5){ m.torso.rotation.y+=s.lookY*0.24; m.head.rotation.y+=s.lookY*0.78; }
    // Kobold-roham: lapuló, ragadozó ugró-sprint
    if(m.dashTimer>0 && m.typeId==='scout'){
      const rush=Math.min(1,m.dashTimer*5);
      m.pelvis.position.y-=0.11*rush; m.torso.rotation.x+=0.34*rush; m.head.rotation.x-=0.24*rush;
      m.arms.L.rotation.x=lerp(m.arms.L.rotation.x,0.85,rush*0.6); m.arms.R.rotation.x=lerp(m.arms.R.rotation.x,0.85,rush*0.6);
      m.arms.L.rotation.z+=0.38*rush; m.arms.R.rotation.z-=0.38*rush;
    }
    if(m._preRaise>0 && !['shaman','spitter','wisp'].includes(m.typeId)){
      const raise=m._preRaise;
      m.arms.R.rotation.x=lerp(m.arms.R.rotation.x,-1.85,raise);
      m.elbows.R.rotation.x=lerp(m.elbows.R.rotation.x,-1.35,raise);
      if(m.typeId==='brute'||m.typeId==='scout'){
        m.arms.L.rotation.x=lerp(m.arms.L.rotation.x,-1.85,raise);
        m.elbows.L.rotation.x=lerp(m.elbows.L.rotation.x,-1.35,raise); }
      m.torso.rotation.x-=0.18*raise;
    }
    const cast=m.casting>0?1-Math.max(0,m.casting)/(m.type.castWind||1):0, recoil=m._castRecoil||0;
    if(m.typeId==='shaman'){
      const ch=Math.max(cast, m.beaming?0.75:0, (m.auraPulse||0)*0.85);
      if(ch>0 || recoil>0){
        m.arms.R.rotation.x=lerp(m.arms.R.rotation.x, recoil>0.2?0.45:-1.95, Math.min(1,ch*1.25+recoil));
        m.elbows.R.rotation.x=lerp(m.elbows.R.rotation.x, -0.55, Math.min(1,ch+recoil));
        m.arms.L.rotation.x=lerp(m.arms.L.rotation.x, m.beaming?-1.05:-1.25, ch*0.85);
        m.arms.L.rotation.z=lerp(m.arms.L.rotation.z, 0.42, ch*0.85);
        m.torso.rotation.x+=-0.20*cast + 0.34*recoil + (m.beaming?0.12:0);
        m.head.rotation.x+=-0.16*cast + 0.20*recoil;
        if(m.jaw) m.jaw.rotation.x=Math.max(m.jaw.rotation.x, 0.38*ch + 0.25*recoil);
      }
    } else if(m.typeId==='spitter'){
      const spitPrep=(m.rangedTimer!=null && m.rangedTimer>0 && m.rangedTimer<0.42)?1-m.rangedTimer/0.42:0;
      if(spitPrep>0 || recoil>0){
        m.torso.rotation.x+=-0.24*spitPrep + 0.52*recoil;
        m.head.rotation.x+=-0.22*spitPrep + 0.36*recoil;
        m.arms.L.rotation.x+=0.45*recoil; m.arms.R.rotation.x+=0.45*recoil;
        m.arms.L.rotation.z+=0.32*recoil; m.arms.R.rotation.z-=0.32*recoil;
        if(m.jaw) m.jaw.rotation.x=Math.max(m.jaw.rotation.x, 0.22*spitPrep + 0.72*recoil);
      }
    } else if(cast>0 || recoil>0 || m.beaming){
      m.arms.R.rotation.x=lerp(m.arms.R.rotation.x,-1.15,Math.min(1,cast*3+recoil+(m.beaming?0.8:0)));
      m.elbows.R.rotation.x-=0.65*Math.max(cast,recoil);
      m.head.rotation.x-=recoil*0.12;
    }
    // Másodlagos rugó-mozgás: fej-utánkövetés, állkapocs és fegyver-tehetetlenség
    if(!m.bossState){
      const chestY=m.pelvis.rotation.y+m.torso.rotation.y;
      m.head.rotation.y+=_stepSpr(s.spr.hy, chestY, 85, 0.58, dtS)-chestY;
      m.head.rotation.x+=_stepSpr(s.spr.hx, m.torso.rotation.x*0.35, 105, 0.62, dtS)-m.torso.rotation.x*0.35;
      if(m.jaw) m.jaw.rotation.x=Math.max(0, m.jaw.rotation.x + _stepSpr(s.spr.jaw, m.head.rotation.x*0.22, 130, 0.4, dtS)*0.45);
      if(m._club) m._club.rotation.z+=_stepSpr(s.spr.wz, -m.arms.R.rotation.x*0.14, 70, 0.52, dtS);
    }
  }
  if(m.bossState){
    const b=m.bossState, wind=b.wind?Math.min(1,b.t/b.wind):0;
    if(b.kind==='recover'){
      const e=Math.min(1,b.t/0.22)*Math.min(1,Math.max(0,(b.duration-b.t)/0.20)), pant=Math.sin(b.t*6.5);
      m.pelvis.position.y=lerp(m.pelvis.position.y, 0.73+pant*0.024, e);
      m.knees.L.rotation.x=lerp(m.knees.L.rotation.x, 0.72, e); m.knees.R.rotation.x=lerp(m.knees.R.rotation.x, 0.58, e);
      m.legs.L.rotation.x=lerp(m.legs.L.rotation.x, -0.32, e); m.legs.R.rotation.x=lerp(m.legs.R.rotation.x, -0.20, e);
      m.torso.rotation.x+=(0.48+pant*0.05)*e;
      m.head.rotation.x+=(0.38+pant*0.07)*e; m.head.rotation.z+=Math.sin(b.t*3.2)*0.12*e;
      m.arms.L.rotation.x=lerp(m.arms.L.rotation.x, 0.96+pant*0.06, e); m.arms.R.rotation.x=lerp(m.arms.R.rotation.x, 1.02+pant*0.06, e);
      m.elbows.L.rotation.x=lerp(m.elbows.L.rotation.x, -0.18, e); m.elbows.R.rotation.x=lerp(m.elbows.R.rotation.x, -0.18, e);
      if(m.jaw) m.jaw.rotation.x=(0.34+0.12*pant)*e;
    } else if(b.kind==='charge'){
      if(b.t<b.wind){
        const w=easeInOut(wind), paw=Math.sin(b.t*14)*w;
        m.pelvis.position.y=0.95-0.18*w;
        m.torso.rotation.x+=0.42*w; m.head.rotation.x-=0.28*w;
        m.arms.L.rotation.x=lerp(m.arms.L.rotation.x,-0.62,w); m.arms.R.rotation.x=lerp(m.arms.R.rotation.x,-0.62,w);
        m.arms.L.rotation.z=0.44*w; m.arms.R.rotation.z=-0.44*w;
        m.elbows.L.rotation.x=lerp(m.elbows.L.rotation.x,-1.05,w); m.elbows.R.rotation.x=lerp(m.elbows.R.rotation.x,-1.05,w);
        m.legs.R.rotation.x=paw*0.34; m.knees.R.rotation.x=0.22+Math.max(0,paw)*0.55;
        if(m.jaw) m.jaw.rotation.x=0.55*w;
      } else {
        m.pelvis.position.y-=0.12; m.torso.rotation.x+=0.48; m.torso.rotation.y+=0.18; m.head.rotation.x-=0.34;
        m.arms.L.rotation.z+=0.34; m.arms.R.rotation.z-=0.34;
        if(m.jaw) m.jaw.rotation.x=0.42;
      }
    } else if(b.kind==='rocks'){
      s.rig.genome.atk='slam';
      if(b.t<b.wind){
        A.attack(s.rig, wind*0.48);
        m.torso.rotation.z+=Math.sin(b.t*24)*0.03*wind;
      } else {
        const cyc=((b.t-b.wind)/0.28)%1;
        A.attack(s.rig, 0.48+Math.min(1,cyc*1.35)*0.52);
      }
    } else {
      s.rig.genome.atk='slam';
      const post=b.t>=b.wind?Math.min(1,(b.t-b.wind)/0.15):0;
      const clipU=b.t<b.wind?wind*0.50:0.50+post*0.50;
      A.attack(s.rig, clipU);
      if(b.t<b.wind) m.torso.rotation.z+=Math.sin(b.t*26)*0.028*wind;
      if(b.kind==='roots'){ m.arms.L.rotation.z+=0.30; m.arms.R.rotation.z-=0.30; }
    }
  }
  m._castRecoil=Math.max(0,(m._castRecoil||0)-dt*4);
  // Weight shifts live on the pelvis, never on the authoritative world root.
  if(!(m.bossState && m.bossState.kind==='recover')){
    m.pelvis.position.x=s.rig.g.position.x*s.weight;
    if(m.typeId!=='wisp' && !(m.bossState && m.bossState.kind==='charge' && m.bossState.t<m.bossState.wind))
      m.pelvis.position.y+=s.rig.g.position.y*s.weight;
  }
  const alpha=m.atkPhase>0?1:1-Math.exp(-dt*18);
  for(let i=0;i<s.nodes.length;i++){ const n=s.nodes[i], j=i*6;
    n.rotation.set(lerp(s.pose[j],n.rotation.x,alpha),lerp(s.pose[j+1],n.rotation.y,alpha),lerp(s.pose[j+2],n.rotation.z,alpha));
    n.position.set(lerp(s.pose[j+3],n.position.x,alpha),lerp(s.pose[j+4],n.position.y,alpha),lerp(s.pose[j+5],n.position.z,alpha));
    s.pose[j]=n.rotation.x; s.pose[j+1]=n.rotation.y; s.pose[j+2]=n.rotation.z;
    s.pose[j+3]=n.position.x; s.pose[j+4]=n.position.y; s.pose[j+5]=n.position.z; }
  s.hit*=Math.exp(-dt*11);
  m.torso.rotation.x+=s.hit*0.24*s.hf;
  m.head.rotation.x+=s.hit*0.36*s.hf;
  if(s.hl){ m.torso.rotation.y+=s.hit*0.50*s.hl; m.torso.rotation.z-=s.hit*0.26*s.hl; m.head.rotation.z-=s.hit*0.22*s.hl; }   // oldalról kapott találat: a váll hátracsapódik, a fej utána billen
}
function animateDeathJoints(m,k){
  if(!m.gen) return;
  const f=easeOutCubic(Math.min(1,k/0.55)), fold=m.deathStyle==='crumple';
  for(const side of ['L','R']){
    m.elbows[side].rotation.x=lerp(m._deathElbows[side],fold?-1.1:-0.15,f);
    m.knees[side].rotation.x=lerp(m._deathKnees[side],fold?1.9:0.5,f);
    m.fists[side].rotation.x=m._deathWrists[side]*(1-f);
  }
  if(m.jaw) m.jaw.rotation.x=0.15*f;
  m.pelvis.position.copy(m._deathPelvis);
  m.pelvis.position.x*=1-f;
  m.pelvis.position.y=lerp(m.pelvis.position.y,0.95,f);
  m.pelvis.rotation.set(0,0,0);
  m.torso.rotation.set((m.genome.lean||0)*0.5,0,0);
  const blend=easeInOut(Math.min(1,k/0.22));
  motionRig(m).nodes.forEach((n,i)=>{
    const from=m._deathPose[i];
    n.rotation.set(lerp(from.x,n.rotation.x,blend),lerp(from.y,n.rotation.y,blend),lerp(from.z,n.rotation.z,blend));
  });
}
const ATK_HITFRAC = { gruntSmash:0.55, scoutClaw:0.30, bruteSlam:0.50, shardJab:0.45, wispBite:0.45 };
const ATK = {
  gruntSmash(m,u,lunge){   // bunkó-csapás fentről
    if(u<0.40){ const w=easeInOut(remap(u,0,0.40)); m.arms.R.rotation.x=lerp(0.5,-1.75,w); m.arms.R.rotation.z=lerp(0,-0.3,w); m.arms.L.rotation.x=lerp(0.5,-0.55,w); m.torso.rotation.x=lerp(0,-0.36,w); m.head.rotation.x=lerp(0,-0.24,w); m.g.scale.y=m.scale*lerp(1,0.95,w); if(m._club) m._club.rotation.x=lerp(-0.35,1.55,w); lunge(-0.18*w); }
    else if(u<0.62){ const s=easeOutBack(remap(u,0.40,0.62)); m.arms.R.rotation.x=lerp(-1.75,2.05,s); m.arms.R.rotation.z=lerp(-0.3,0,s); m.arms.L.rotation.x=lerp(-0.55,0.95,s); m.torso.rotation.x=lerp(-0.36,0.5,s); m.head.rotation.x=lerp(-0.24,0.38,s); m.g.scale.y=m.scale*lerp(0.95,1.03,s); if(m._club) m._club.rotation.x=lerp(1.55,-0.55,s); lunge(lerp(-0.18,0.32,s)); }
    else { const r=easeOutCubic(remap(u,0.62,1)); m.arms.R.rotation.x=lerp(2.05,0.5,r); m.arms.L.rotation.x=lerp(0.95,0.5,r); m.torso.rotation.x=lerp(0.5,0,r); m.head.rotation.x=lerp(0.38,0,r); m.g.scale.y=m.scale*lerp(1.03,1,r); if(m._club) m._club.rotation.x=lerp(-0.55,-0.35,r); lunge(0.32*(1-r)); }
  },
  scoutClaw(m,u,lunge){   // gyors kettős karom-csapás
    if(u<0.08){ const w=remap(u,0,0.08); m.arms.R.rotation.x=lerp(0.5,-0.5,w); m.arms.L.rotation.x=lerp(0.5,0.2,w); }
    else { const s1=easeOutBack(remap(u,0.08,0.34)); m.arms.R.rotation.x=lerp(-0.5,1.4,s1); m.arms.R.rotation.z=lerp(0,0.5,s1); m.arms.L.rotation.x=lerp(0.2,-0.6,s1); m.torso.rotation.z=lerp(0,0.2,s1);
      if(u>=0.34){ const s2=easeOutBack(remap(u,0.34,0.65)); m.arms.L.rotation.x=lerp(-0.6,1.4,s2); m.arms.L.rotation.z=lerp(0,-0.5,s2); m.arms.R.rotation.x=lerp(1.4,0.3,s2); m.torso.rotation.z=lerp(0.2,-0.2,s2); } }
    m.g.scale.y=m.scale*(1+0.05*Math.sin(u*Math.PI)); lunge(0.18*Math.sin(u*Math.PI));
    if(u>=0.65){ const r=easeOutCubic(remap(u,0.65,1)); m.arms.L.rotation.x=lerp(1.4,0.5,r); m.arms.R.rotation.x=lerp(0.3,0.5,r); m.arms.L.rotation.z=lerp(-0.5,0,r); m.arms.R.rotation.z=lerp(0.5,0,r); m.torso.rotation.z=lerp(-0.2,0,r); m.g.scale.y=m.scale; }
  },
  bruteSlam(m,u,lunge){   // két ököl földre-csapás (a buzogány a g-n marad, nem leng — testtel adjuk a súlyt)
    if(u<0.45){ const w=easeInOut(remap(u,0,0.45)); m.arms.L.rotation.x=m.arms.R.rotation.x=lerp(0.5,-1.85,w); m.arms.L.rotation.z=lerp(0,0.2,w); m.arms.R.rotation.z=lerp(0,-0.2,w); m.torso.rotation.x=lerp(0,-0.25,w); m.head.rotation.x=lerp(0,0.30,w); m.legs.L.rotation.x=m.legs.R.rotation.x=lerp(0,0.35,w); m.g.scale.set(m.scale*(1+0.06*w),m.scale*(1-0.12*w),m.scale*(1+0.06*w)); lunge(-0.10*w); }
    else if(u<0.60){ const s=easeOutBack(remap(u,0.45,0.60)); m.arms.L.rotation.x=m.arms.R.rotation.x=lerp(-1.85,2.1,s); m.arms.L.rotation.z=lerp(0.2,0,s); m.arms.R.rotation.z=lerp(-0.2,0,s); m.torso.rotation.x=lerp(-0.25,0.40,s); m.legs.L.rotation.x=m.legs.R.rotation.x=lerp(0.35,0,s); m.g.scale.set(m.scale*lerp(1.06,0.96,s),m.scale*lerp(0.88,1.04,s),m.scale*lerp(1.06,0.96,s)); lunge(lerp(-0.10,0.28,s)); }
    else { const r=easeOutCubic(remap(u,0.60,1)); m.arms.L.rotation.x=m.arms.R.rotation.x=lerp(1.95,0.5,r); m.torso.rotation.x=lerp(0.40,0,r); m.head.rotation.x=lerp(0.30,0,r); m.g.scale.set(m.scale,m.scale,m.scale); lunge(0.28*(1-r)); }
  },
  shardJab(m,u,lunge){   // rövid egyenes bökés
    if(u<0.15){ const w=remap(u,0,0.15); m.arms.R.rotation.x=lerp(0.5,0.0,w); m.torso.rotation.z=lerp(0,0.12,w); }
    else if(u<0.45){ const s=easeOutBack(remap(u,0.15,0.45)); m.arms.R.rotation.x=lerp(0.0,1.5,s); m.torso.rotation.z=lerp(0.12,-0.08,s); lunge(0.20*s); }
    else { const r=easeOutCubic(remap(u,0.45,1)); m.arms.R.rotation.x=lerp(1.5,0.5,r); m.torso.rotation.z=lerp(-0.08,0,r); lunge(0.20*(1-r)); }
  },
  wispBite(m,u,lunge){   // hátrahúz, majd nagy elővetődés-harapás
    if(u<0.20){ const w=easeInOut(remap(u,0,0.20)); m.torso.rotation.x=lerp(0,-0.35,w); m.head.rotation.x=lerp(0,-0.25,w); m.arms.L.rotation.x=m.arms.R.rotation.x=lerp(0.5,-0.2,w); m.g.scale.set(m.scale*(1-0.06*w),m.scale*(1+0.10*w),m.scale*(1-0.06*w)); lunge(-0.20*w); }
    else if(u<0.50){ const s=easeOutBack(remap(u,0.20,0.50)); m.torso.rotation.x=lerp(-0.35,0.55,s); m.head.rotation.x=lerp(-0.25,0.45,s); m.arms.L.rotation.x=m.arms.R.rotation.x=lerp(-0.2,1.2,s); m.g.scale.set(m.scale*lerp(0.94,1.08,s),m.scale*lerp(1.10,0.94,s),m.scale*lerp(0.94,1.08,s)); lunge(lerp(-0.20,0.45,s)); }
    else { const r=easeOutCubic(remap(u,0.50,1)); m.torso.rotation.x=lerp(0.55,0,r); m.head.rotation.x=lerp(0.45,0,r); m.arms.L.rotation.x=m.arms.R.rotation.x=lerp(1.2,0.5,r); m.g.scale.set(m.scale,m.scale,m.scale); lunge(0.45*(1-r)); }
  },
};
// LIDÉRC-AURA (SP): minden frame újraszámolva — a közeli (3m) trollokat felerősíti + cián gyűrűvel jelöli
function applyWispAuras(){   // LIDÉRC erősítő-aura KIVÉVE (túl OP volt) — már nem osztunk buffot, csak takarítjuk a maradékot (a wispBuff így mindig 0 marad -> a szorzók ×1)
  for(const m of monsters){ if(m.wispBuff){ m.wispBuff=0; if(m._buffRing) m._buffRing.visible=false; } }
}
function tacticalHeading(m,dt,dx,dz,d){
  if(coop) return {x:dx/d,z:dz/d,clear:true};
  const a=m.tactics||(m.tactics={side:Math.sin(m.seed*19)>0?1:-1,timer:0,x:dx/d,z:dz/d,clear:true});
  a.timer-=dt;
  if(a.timer>0) return a;
  a.timer=0.25+(Math.abs(Math.sin(m.seed))*0.15);
  const p=m.g.position, ranged=['spitter','shaman','wisp'].includes(m.typeId);
  a.clear=!sightBlocked(p.x,p.y+m.bodyCY,p.z,player.pos.x,player.pos.y-0.3,player.pos.z);
  let tx=player.pos.x,tz=player.pos.z;
  if(d>4 && !ranged){
    const lead=m.typeId==='brute'?0.55:0.3;
    tx+=playerMotion.x*lead;tz+=playerMotion.z*lead;
    if(m.typeId==='scout'||m.typeId==='grunt'){
      const flank=Math.min(3.2,(d-4)*0.4)*a.side;
      tx+=-dz/d*flank;tz+=dx/d*flank;
    }
  }
  let vx=tx-p.x,vz=tz-p.z;
  if(ranged){
    if(!a.clear){ vx=dx/d*0.22-dz/d*a.side; vz=dz/d*0.22+dx/d*a.side; }
    else if(d>=6 && d<=17){ vx=-dz/d*a.side; vz=dx/d*a.side; } // tiszta rálátásnál tisztán érintőirányú oldalazás (nem csúszik rá a bandMin határra!)
  }
  const len=Math.hypot(vx,vz)||1;a.x=vx/len;a.z=vz/len;
  return a;
}
function trollAI(m, dt, t){
  if(!(running && player.alive)) return;
  const T=m.type, p=m.g.position;
  const dx=player.pos.x-p.x, dz=player.pos.z-p.z, d=Math.hypot(dx,dz)||0.0001;
  const tactics=tacticalHeading(m,dt,dx,dz,d);
  const playerYaw=Math.atan2(dx,dz);
  let aimYaw=playerYaw;
  if(!coop && d>3.4 && m.atkPhase<=0 && !m.beaming && !(m.casting>0)){
    const moveYaw=Math.atan2(tactics.x,tactics.z);
    let diff=moveYaw-playerYaw; diff=Math.atan2(Math.sin(diff),Math.cos(diff));
    aimYaw=playerYaw+clamp(diff,-0.75,0.75)*0.62; // bekerítéskor a törzs természetesen a haladás felé fordul, a fej pedig a játékoson marad
  }
  const turn=aimYaw-m.g.rotation.y;
  if(m.frozenSolid<=0 && m.rooted<=0) m.g.rotation.y+=Math.atan2(Math.sin(turn),Math.cos(turn))*(1-Math.exp(-dt*12));
  { let ly=playerYaw-m.g.rotation.y; m._lookYaw=Math.atan2(Math.sin(ly),Math.cos(ly)); }
  if(m.eliteAura) m.eliteAura.material.opacity=0.42+0.25*Math.abs(Math.sin(t*3));
  if(T.id==='wisp'){ m.hoverPh=(m.hoverPh||0)+dt*2.0; p.y=GROUND_Y+0.55+Math.sin(m.hoverPh)*0.18;   // LIDÉRC: lebeg a talaj fölött (nem jár) -> félreismerhetetlen szellem
    if(m.elAura) m.elAura.material.opacity=0.45+Math.abs(Math.sin(t*2.5))*0.25; }
  if(T.id==='shaman'){ const pulse=0.6+Math.abs(Math.sin(t*3))*0.6;
    if(m.staffCrystal) m.staffCrystal.material.emissiveIntensity=1.0+pulse;
    if(m.auraPulse>0) m.auraPulse=Math.max(0,m.auraPulse-dt*2);
    if(m.aura) m.aura.material.opacity=0.3+pulse*0.18+(m.auraPulse||0)*0.5; }
  if(m.rooted>0 || m.frozenSolid>0){ if(m.rooted>0) m.rooted-=dt; m.arms.R.rotation.x=lerp(m.arms.R.rotation.x,0.5,0.1);
    if(m.atkPhase>0){ m.atkPhase=0; m.atkKind=null; m.atkHit=false; if(m.lungeBase){ p.x=m.lungeBase.x; p.z=m.lungeBase.z; m.lungeBase=null; } m.torso.rotation.set(0,0,0); m.head.rotation.x=0; m.g.scale.set(m.scale,m.scale,m.scale); }   // bénítás lengés közben -> tiszta alapra
    return; }   // bénítás VAGY teljes fagy = mozdulatlan (frozenSolid-et a tickStatus csökkenti)
  const walkAnim=()=>{
    if(m.gen) return; // Articulated clips are evaluated once, after AI movement.
    if(T.id==='wisp'){ const s=Math.sin(m.hoverPh||0); m.arms.L.rotation.x=lerp(m.arms.L.rotation.x,0.25+s*0.14,0.1); m.arms.R.rotation.x=lerp(m.arms.R.rotation.x,0.25-s*0.14,0.1);
      m.head.rotation.x=lerp(m.head.rotation.x, s*0.05, 0.1); return; }   // LIDÉRC: lágy kar-lebegés + apró fej-billenés (a p.y-t a hover állítja) — NINCS torzó-ingás, hogy a fej ne váljon le
    m.walkPhase+=dt*(4+m.speed); const ph=m.walkPhase;
    m.legs.L.rotation.x=Math.sin(ph)*0.6; m.legs.R.rotation.x=-Math.sin(ph)*0.6; p.y=GROUND_Y+Math.abs(Math.sin(ph))*0.07;
    m.arms.L.rotation.x=0.5+Math.sin(ph)*0.35; m.arms.R.rotation.x=0.5-Math.sin(ph)*0.35;
    // FONTOS: a fej a torzó TESTVÉRE (nem gyereke), ezért a torzó oldal-döntése LEVÁLASZTANÁ a fejet.
    // Ezért csak fej-BÓLINTÁS (rotation.x — a nyak-csuklónál pördül, marad a helyén) + enyhe torzó-előredőlés van, oldal-ingás NINCS.
    m.torso.rotation.z=0;
    m.torso.rotation.x=(T.postureLean||0);
    m.head.rotation.z=0; m.head.rotation.x=-Math.abs(Math.sin(ph))*0.05; };
  // KÖZELHARC-FELVEZETÉS (minden melee trollra közös): közeledve ARÁNYOSAN emeli a kart/fegyvert
  // (start = 1.9×ütéstáv, teljesen fent = 1.05×ütéstáv), odaérve a windup kimarad (startAtk._preRaise)
  // -> a lesújtás azonnali és természetes. A fegyver mereven a marokban marad, a KAR viszi a mozdulatot.
  const raiseAmt=(reach)=>{ const startD=reach*1.9, fullD=reach*1.05;
    const r=Math.max(0,Math.min(1,(startD-d)/(startD-fullD)));
    return m._preRaise=Math.pow(r,0.85); };
  const moveToward=(mult)=>{ const step=m.speed*mult*(m.slowMul||1)*dt; const ox=p.x, oz=p.z;
    const vx=mult>0&&d>3?tactics.x:dx/d, vz=mult>0&&d>3?tactics.z:dz/d;
    p.x+=vx*step; p.z+=vz*step; let _pm=pushMob(p.x,p.z,(m.bodyR||0.5)*0.9); p.x=_pm.x; p.z=_pm.z;   // ELEM: slowMul; + nem megy át fán/kövön (mob solids)
    // ANTI-BESZORULÁS (első lépés): ha az akadály miatt alig haladt, oldalazzon el mellette egy irányba, amíg ki nem szabadul
    if(step>1e-4 && Math.hypot(p.x-ox,p.z-oz) < step*0.4){ m._stuckT=(m._stuckT||0)+dt;
      if(m._stuckT>0.3){ if(!m._stuckSide) m._stuckSide=(((p.x*7+p.z*13)|0)&1)?1:-1; const tx=-dz/d*m._stuckSide, tz=dx/d*m._stuckSide;
        p.x+=tx*step*1.4; p.z+=tz*step*1.4; _pm=pushMob(p.x,p.z,(m.bodyR||0.5)*0.9); p.x=_pm.x; p.z=_pm.z; } }
    else { m._stuckT=0; m._stuckSide=0; } };
  const startAtk=(dur,kind)=>{ if(m.atkPhase>0) return; m.atkPhase=0.0001;
    const wf={gruntSmash:0.40,bruteSlam:0.45,scoutClaw:0.08,shardJab:0.15,wispBite:0.20}[kind]||0;   // ha már közeledés közben FELEMELTE a fegyvert, a windup-fázis arányosan kimarad -> odaérve azonnal lesújt
    m.atkT=dur*wf*Math.min(1,m._preRaise||0);
    m.atkDur=dur; m.atkHit=false; m.atkKind=kind; m.lungeBase={x:p.x,z:p.z}; };
  const lunge=(amt)=>{ if(!m.lungeBase) return; const _pm=pushMob(m.lungeBase.x+(dx/d)*amt, m.lungeBase.z+(dz/d)*amt, (m.bodyR||0.5)*0.9); p.x=_pm.x; p.z=_pm.z; };   // pushMob: a lunge ne toljon fába/kőbe
  const endAtk=()=>{ m.atkPhase=0; m.atkKind=null; if(m.lungeBase){ p.x=m.lungeBase.x; p.z=m.lungeBase.z; m.lungeBase=null; } m.torso.rotation.set(0,0,0); m.head.rotation.x=0; if(m._club) m._club.rotation.x=-0.35; m.g.scale.set(m.scale,m.scale,m.scale); };
  const meleeAttack=(kind,dur,onHit,holdRaised)=>{   // 3-fázisú: windup -> strike(onHit a HITFRAC u-n) -> recovery; nem fight a walk/death anim-mal
    if(m.atkPhase<=0){ m.atkCd-=dt;
      const restR=holdRaised?-1.8:0.5;   // bunkós troll ütések KÖZÖTT is fent tartja a botot (nincs le-fel pumpálás)
      m.arms.L.rotation.x=lerp(m.arms.L.rotation.x,0.5,0.15); m.arms.R.rotation.x=lerp(m.arms.R.rotation.x,restR,0.15);
      if(holdRaised){ m._preRaise=1; if(m._club) m._club.rotation.x=lerp(m._club.rotation.x,1.45,0.15); }
      else m._preRaise=Math.max(0,(m._preRaise||0)-dt*2.5);
      if(m.atkCd<=0) startAtk(dur,kind); return; }
    m.atkT+=dt; const u=Math.min(1,m.atkT/m.atkDur); m.atkPhase=u;
    const fn=ATK[kind]; if(fn) fn(m,u,lunge);
    if(!m.atkHit && u>=(ATK_HITFRAC[kind]||0.5)){ m.atkHit=true;
      // BECSAPÓDÁS-EFFEKT az ütés pillanatában (találattól függetlenül — a csapás a földet/levegőt éri)
      { const ix=p.x+(dx/d)*1.1*m.scale, iz=p.z+(dz/d)*1.1*m.scale;
        if(kind==='gruntSmash'||kind==='bruteSlam'){ const big=(kind==='bruteSlam');
          EFX.ring(ix,GROUND_Y+0.05,iz,big?0xd8c8a8:0xbfcab0,0.30,(big?2.8:1.7)*m.scale,0.35,0.55);
          for(let i2=0;i2<(big?10:6);i2++) RP.spawn(ix+rand(-0.3,0.3),GROUND_Y+0.1,iz+rand(-0.3,0.3), rand(-1.5,1.5),rand(0.5,2.2),rand(-1.5,1.5), pick([0x8a795c,0xa89a78,0x6f7a5a]), rand(0.4,0.7),0.05, rand(0.3,0.6), 4,1);
          if(big){ SMK.spawn(ix,GROUND_Y+0.2,iz,0,0.8,0,0x3a3428,0.5,1.6,0.8,-0.5,1,0.4); }
        } else if(kind==='scoutClaw'||kind==='shardJab'){ sparks.burst(ix,p.y+1.2*m.scale,iz,6,0xd8e0c8,4,0.3); }
        else if(kind==='wispBite'){ sparks.burst(ix,p.y+1.2*m.scale,iz,8,0x9fe3ff,4,0.35); } }
      if(player.pos.y-1.7 < p.y+1.9*m.scale){ onHit(); } else { m.atkCd=0.4; endAtk(); return; } }   // függőleges hatótáv-kapu megtartva
    if(u>=1) endAtk();
  };
  switch(T.id){
    case 'scout': {
      m.dashCd-=dt;
      if(m.dashTimer>0){ m.dashTimer-=dt; }
      else if(d>2.2 && d<12 && m.dashCd<=0){ m.dashTimer=0.4; m.dashCd=rand(1.2,2.0); if(AUD.growl)AUD.growl(); }
      const rushMul = 1.0 + Math.min(0.8, wave*0.04);   // FEJLESZTÉS: hullámmal gyorsuló roham (cap +80%)
      if(d>1.5 && m.atkPhase<=0){ moveToward((m.dashTimer>0?2.8:1.0)*rushMul*(m.wispBuff?(TROLL_TYPES.wisp.auraSpd||1.25):1)); walkAnim();
        const raise=raiseAmt(1.5);
        if(raise>0){ m.arms.L.rotation.x=lerp(m.arms.L.rotation.x,-0.7,raise); m.arms.R.rotation.x=lerp(m.arms.R.rotation.x,-0.7,raise);
          m.arms.L.rotation.z=0.5*raise; m.arms.R.rotation.z=-0.5*raise; } }   // karmok szétnyitva, ugrásra kész
      else meleeAttack('scoutClaw',0.38,()=>{ m.atkCd=0.55; damagePlayerFrom(m, meleeBase()*m.dmgMul*(m.wispBuff?(TROLL_TYPES.wisp.auraDmg||1.35):1)); });   // gyorsabb harapás
      break;
    }
    case 'brute': {
      const REACH=Math.max(2.3, 1.55*m.scale);
      if(d>REACH && m.atkPhase<=0){ moveToward(1.0); walkAnim();
        const raise=raiseAmt(REACH);
        if(raise>0){ m.arms.L.rotation.x=lerp(m.arms.L.rotation.x,-1.85,raise); m.arms.R.rotation.x=lerp(m.arms.R.rotation.x,-1.85,raise);
          m.arms.L.rotation.z=0.35*raise; m.arms.R.rotation.z=-0.35*raise;   // mindkét ököl fel, széttartva
          m.torso.rotation.x=(T.postureLean||0)-0.25*raise; }
      }
      else meleeAttack('bruteSlam',1.5,()=>{ m.atkCd=2.2; damagePlayerFrom(m, meleeBase()*m.dmgMul*(m.wispBuff?(TROLL_TYPES.wisp.auraDmg||1.35):1));
        const kb=3.2; player.pos.x+=dx/d*kb; player.pos.z+=dz/d*kb;
        { const r=resolveMove(player.pos.x, player.pos.z, player.feet); player.pos.x=r.x; player.pos.z=r.z; }
        clampToBoundary();
        shake=Math.max(shake,0.5); m.rooted=0.5; gore.burst(p.x,p.y+m.bodyCY*0.5,p.z,10,0x6f7a72,4,0.3); });
      break;
    }
    case 'shaman': {
      if(coopIsRemote(m)) break;   // co-op: a szerver vezérli a sámánt (a nyaláb/lövedék FX a monster_fx-ből)
      // pozicionálás: közel hátrál, távol közelít a varázs-sávba
      if(d<5.0){ moveToward(-0.8); walkAnim(); }
      else if(d>T.castRange+2){ moveToward(0.7); walkAnim(); }
      else if(!coop && !tactics.clear){ moveToward(0.65); walkAnim(); }
      else { m.arms.L.rotation.x=0.5+Math.sin(t*2)*0.15; m.arms.R.rotation.x=0.5+Math.cos(t*2)*0.15;
        m.torso.rotation.x=(T.postureLean||0)+Math.sin(t*1.5)*0.03; m.head.rotation.z=0; m.head.rotation.x=-Math.sin(t*1.5)*0.025; }   // idle: bólogató kántálás (oldal-ingás nélkül)
      // MÓD A: NAGY TÁVRÓL arkán lövedék (telegrafált felhúzás -> lövés)
      if(tactics.clear && d>T.castRange && d<T.castMax){ if(m.casting<=0){ m.castTimer-=dt; if(m.castTimer<=0) m.casting=T.castWind; }
        if(m.casting>0){ m.casting-=dt; m.arms.R.rotation.x=-0.9; if(m.staffCrystal) m.staffCrystal.material.emissiveIntensity=1.4+2.2*(1-Math.max(0,m.casting)/T.castWind);
          if(m.casting<=0){ m._castRecoil=1; shamanCast(m); m.castTimer=T.castCd*rand(0.9,1.2); } } }
      else m.casting=0;
      // MÓD B: KÖZELRŐL folyamatos gyengítő-nyaláb (4Hz akkumulátor -> tick-független, pontosan beamDps/mp)
      if(tactics.clear && d < (m.beaming?T.beamDrop:T.beamNear)){ m.beaming=true; m.beamAcc=(m.beamAcc||0)+dt; const period=1/T.beamTickHz;
        while(m.beamAcc>=period){ m.beamAcc-=period; damagePlayerFrom(m, T.beamDps*period); } applyWither(0.3);
        if(m.staffCrystal) m.staffCrystal.getWorldPosition(_shSp); else _shSp.set(p.x,p.y+m.bodyCY,p.z);
        drawBeam(_shSp.x,_shSp.y,_shSp.z, player.pos.x, player.pos.y-0.3, player.pos.z, t); }
      else m.beaming=false;
      m.healTimer-=dt;
      if(m.healTimer<=0 && m.statusEl!=='poison'){ m.healTimer=T.healCd;   // MÉREG elnémítja a sámán gyógyítását
        for(const o of monsters){ if(o===m || !o.alive || o.dying>0) continue;
          const od=Math.hypot(o.g.position.x-p.x, o.g.position.z-p.z);
          if(od<T.healRadius && o.hp<o.maxHp){ o.hp=Math.min(o.maxHp,o.hp+T.healAmt); o.hurtFlash=0.12;
            sparks.burst(o.g.position.x,o.g.position.y+o.bodyCY,o.g.position.z,8,0x36c5ff,4,0.5); } }
        sparks.burst(p.x,p.y+m.bodyCY,p.z,20,0x36c5ff,7,0.4); m.auraPulse=1; }
      break;
    }
    case 'spitter': {
      if(d<T.bandMin){ moveToward(-0.9); walkAnim(); }
      else if(d>T.bandMax){ moveToward(0.8); walkAnim(); }
      else if(!coop && (!tactics.clear || m.rangedTimer>0.38)){ moveToward(tactics.clear?0.32:0.58); walkAnim(); }
      else { m.arms.L.rotation.x=0.3; m.arms.R.rotation.x=0.3;
        m.torso.rotation.x=(T.postureLean||0)+Math.sin(t*1.8)*0.03; m.torso.rotation.z=0; m.head.rotation.x=-Math.sin(t*1.8)*0.03; }   // idle-légzés: torzó előre-hátra + fej-bólintás EGYÜTT (nincs oldal-ingás, a fej nem válik le)
      m.rangedTimer-=dt;
      if(tactics.clear && m.rangedTimer<=0 && d>=T.bandMin-1 && d<=T.bandMax+3){ m.rangedTimer=T.rangedCd*rand(0.85,1.15); m._castRecoil=1; m.arms.R.rotation.x=-0.6; spitterFire(m); if(wave>10) spitterFire(m, rand(0.10,0.22)*(Math.random()<0.5?1:-1)); }   // FEJLESZTÉS: a 2. lövedék CSAK wave 10 felett (mint a brute-osztódás)
      break;
    }
    case 'grunt': {
      // ÜTÉSTÁV: kar (~0.78) + bot a fejéig (~0.85) + lunge (0.32) skálázva -> lecsapáskor a bunkó VÉGE pont elér
      const REACH=2.3*m.scale;
      if(d>REACH && m.atkPhase<=0){ moveToward(1.0); walkAnim();
        const raise=raiseAmt(REACH);   // ~4.4m-nél kezdi, ütéstávhoz érve teljesen fent
        if(raise>0){
          // FŐLEG A KAR emel: magasra, könyökkel KIFELÉ (szemből is tisztán olvasható)
          m.arms.R.rotation.x=lerp(m.arms.R.rotation.x, -1.95, raise);
          m.arms.R.rotation.z=-0.5*raise;
          if(m._club) m._club.rotation.x=-0.35+1.9*raise;   // CSUKLÓ: a bot felfelé áll az emelt kézben (ütésre kész), nem lóg le
          m.arms.L.rotation.x=lerp(m.arms.L.rotation.x, -0.25, raise*0.6);   // ellensúly-kéz kicsit fel
          m.torso.rotation.x=(T.postureLean||0)-0.22*raise;                  // hátradőlés az emeléshez
          m.head.rotation.x=m.head.rotation.x-0.12*raise;                    // felnéz az ütéshez
        }
      }
      else meleeAttack('gruntSmash',1.05,()=>{ m.atkCd=1.1; damagePlayerFrom(m, meleeBase()*m.dmgMul*(m.wispBuff?(TROLL_TYPES.wisp.auraDmg||1.35):1)); }, true);
      break;
    }
    case 'shard': {
      if(d>1.8 && m.atkPhase<=0){ moveToward(1.0); walkAnim();
        const raise=raiseAmt(1.8);
        if(raise>0){ m.arms.R.rotation.x=lerp(m.arms.R.rotation.x,-0.6,raise); m.torso.rotation.z=0.12*raise; } }   // hátrahúzott döfő-kéz
      else meleeAttack('shardJab',0.30,()=>{ m.atkCd=0.8; damagePlayerFrom(m, meleeBase()*m.dmgMul*(m.wispBuff?(TROLL_TYPES.wisp.auraDmg||1.35):1)); });
      break;
    }
    case 'wisp': { m.rangedTimer=(m.rangedTimer==null?T.rangedCd*rand(0.5,1.0):m.rangedTimer-dt);   // FEJLESZTÉS: távolról jég-lövedék, közelről harap; aura-szorzók
      if(d<2.2){ meleeAttack('wispBite',0.45,()=>{ m.atkCd=0.9; damagePlayerFrom(m, meleeBase()*m.dmgMul*(m.wispBuff?(TROLL_TYPES.wisp.auraDmg||1.35):1)); }); }
      else { if(d>T.bandMax){ moveToward(0.9*(m.wispBuff?(TROLL_TYPES.wisp.auraSpd||1.25):1)); } else if(d<T.bandMin){ moveToward(-0.7); } walkAnim();
        { const raise=raiseAmt(2.2); if(raise>0){ m.arms.L.rotation.x=lerp(m.arms.L.rotation.x,-0.35,raise); m.arms.R.rotation.x=lerp(m.arms.R.rotation.x,-0.35,raise); m.head.rotation.x=lerp(m.head.rotation.x,-0.25*raise,0.5); } }   // hátrahúzódzó harapás-felvezetés
        if(tactics.clear && m.rangedTimer<=0 && d>=T.bandMin-1 && d<=T.bandMax+3){ m.rangedTimer=T.rangedCd*rand(0.85,1.15); m._castRecoil=1; m.arms.R.rotation.x=-0.7; wispFire(m); } }
      break; }
    default: {
      const REACH=2.2*m.scale;
      if(d>REACH && m.atkPhase<=0){ moveToward(1.0); walkAnim();
        const raise=raiseAmt(REACH);
        if(raise>0){ m.arms.R.rotation.x=lerp(m.arms.R.rotation.x,-1.95,raise); m.arms.R.rotation.z=-0.5*raise;
          m.torso.rotation.x=(T.postureLean||0)-0.22*raise; }
      }
      else meleeAttack('gruntSmash',1.0,()=>{ m.atkCd=1.3; damagePlayerFrom(m, meleeBase()*m.dmgMul*(m.wispBuff?(TROLL_TYPES.wisp.auraDmg||1.35):1)); }, true);
    }
  }
}

