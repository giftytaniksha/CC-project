/** Presentation geometry only. No account, nutrition, session or API data enters this module. */
export type AuroraBand = {level:number;amplitude:number;depth:number;phase:number;speed:number;color:number;strength:number};
export type AuroraPoint = {x:number;y:number};
export const AURORA_BANDS:readonly AuroraBand[] = [
  {level:.10,amplitude:.16,depth:.32,phase:.4,speed:.19,color:2,strength:.55},
  {level:.18,amplitude:.19,depth:.30,phase:2.1,speed:-.16,color:0,strength:.6},
  {level:.55,amplitude:.17,depth:.28,phase:4.8,speed:.14,color:3,strength:.48},
  {level:.65,amplitude:.13,depth:.29,phase:1.3,speed:-.21,color:1,strength:.47},
  {level:.62,amplitude:.11,depth:.23,phase:3.6,speed:.13,color:4,strength:.22},
];
export const AURORA_COLORS = {
  dark:[[206,105,139],[206,128,152],[181,214,233],[142,140,178],[237,218,204]],
  light:[[255,206,217],[237,218,204],[181,214,233],[152,143,232],[92,139,183]],
} as const;

/** Incommensurate phases make broad crests rise, fold and cross without a short looping clip. */
export function auroraRibbon(band:AuroraBand,time:number,width:number,height:number,segments=56) {
  const top:AuroraPoint[]=[],bottom:AuroraPoint[]=[];
  for(let i=0;i<=segments;i++) {
    const u=-.12+i/segments*1.24;
    const phase=time*band.speed+band.phase;
    const wave=Math.sin(u*5.4+phase)*.66+Math.sin(u*9.1-phase*.67+band.phase)*.25+Math.cos(u*2.7+time*.073+band.phase)*.3;
    const tide=Math.sin(time*.097+band.phase)*.055;
    const y=band.level+wave*band.amplitude+tide;
    const depth=band.depth*(.8+.2*Math.sin(u*4.2-phase*.43));
    top.push({x:u*width,y:y*height});
    bottom.push({x:u*width,y:(y+depth)*height});
  }
  return {top,bottom};
}

export function ribbonSvgPath(band:AuroraBand,time=0,width=1440,height=1000) {
  const {top,bottom}=auroraRibbon(band,time,width,height);
  return 'M'+[...top,...bottom.reverse()].map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('L')+'Z';
}

export function auroraResolution(width:number,height:number) {
  const mobile=width<768;
  const scale=Math.min(1,(mobile?680:1100)/Math.max(1,width),Math.sqrt((mobile?300000:650000)/Math.max(1,width*height)));
  return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale)),fps:mobile?24:30};
}

export function drawAurora(ctx:CanvasRenderingContext2D,width:number,height:number,time:number,darkMix:number) {
  ctx.clearRect(0,0,width,height);
  ctx.globalCompositeOperation='source-over';
  // Blur a bounded bitmap, not a full-resolution DOM tree or the foreground content.
  ctx.filter=`blur(${Math.max(7,width*.014)}px)`;
  for(const band of AURORA_BANDS) {
    const {top,bottom}=auroraRibbon(band,time,width,height);
    const light=AURORA_COLORS.light[band.color],dark=AURORA_COLORS.dark[band.color];
    const color=light.map((v,i)=>Math.round(v+(dark[i]-v)*darkMix)).join(',');
    const min=Math.min(...top.map(p=>p.y)),max=Math.max(...bottom.map(p=>p.y));
    const alpha=band.strength*(.46+darkMix*.54)*(.93+.07*Math.sin(time*.29+band.phase));
    const gradient=ctx.createLinearGradient(0,min,0,max);
    gradient.addColorStop(0,`rgba(${color},0)`);
    gradient.addColorStop(.2,`rgba(${color},${alpha*.28})`);
    gradient.addColorStop(.44,`rgba(${color},${alpha})`);
    gradient.addColorStop(.7,`rgba(${color},${alpha*.48})`);
    gradient.addColorStop(1,`rgba(${color},0)`);
    ctx.fillStyle=gradient;
    ctx.beginPath();
    ctx.moveTo(top[0].x,top[0].y);
    for(let i=1;i<top.length;i++)ctx.lineTo(top[i].x,top[i].y);
    for(let i=bottom.length-1;i>=0;i--)ctx.lineTo(bottom[i].x,bottom[i].y);
    ctx.closePath();ctx.fill();
  }
  ctx.filter='none';
}
