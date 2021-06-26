
const canvas = document.getElementById("canvas");
const generateBtn = document.getElementById("generate");
const ctx = canvas.getContext("2d");

const magnets = [];
const pm = {
  resolution: 0.125,
  timeStep: 0.3,
  weight: 0.1,
  magnetForce: 0.001,
  drag: 0.05,
  magnetDepth: 0.1,
  stringLength: 2,
  maxSteps: 1000,
  hideMagnets: false,
}
const magnetSize = 16;
const sleepSteps = 200;
let generating = false;
let background;

function resetCanvas() {
  canvas.width = Math.round(canvas.clientWidth * pm.resolution);
  canvas.height = Math.round(canvas.clientHeight * pm.resolution);
  background = new ImageData(canvas.width, canvas.height);
  generating = false;
}
resetCanvas()
window.addEventListener("resize", resetCanvas);

let preview = {
  x: 0.5,
  y: 0.5,
  vx: 0,
  vy: 0,
}

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function simulate(pendulum) {
  let center = {
    x: 0.5,
    y: 0.5,
  }
  
  const string = Math.sqrt(2) / 2 * pm.stringLength;
  const force = -pm.weight * dist(center, pendulum) / string;
  const angle = Math.atan2(pendulum.x - center.x, pendulum.y - center.y);
  pendulum.vx += force * Math.sin(angle) * pm.timeStep;
  pendulum.vy += force * Math.cos(angle) * pm.timeStep;
  
  for(const magnet of magnets) {
    const planeDist = dist(magnet, pendulum);
    const force = -pm.magnetForce / Math.sqrt(planeDist ** 2 + pm.magnetDepth ** 2) ** 2 * Math.sin(Math.atan(Math.abs(planeDist / pm.magnetDepth)));
    
    const angle = Math.atan2(pendulum.x - magnet.x, pendulum.y - magnet.y);
    pendulum.vx += force * Math.sin(angle) * pm.timeStep;
    pendulum.vy += force * Math.cos(angle) * pm.timeStep;
  }
  
  pendulum.vx *= (1 - pm.drag) ** pm.timeStep;
  pendulum.vy *= (1 - pm.drag) ** pm.timeStep;
  
  pendulum.x += pendulum.vx * pm.timeStep;
  pendulum.y += pendulum.vy * pm.timeStep;
}

function animation() {
  simulate(preview);
  redraw();
  requestAnimationFrame(animation);
}
requestAnimationFrame(animation)

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(background, 0, 0);
  
  if(pm.hideMagnets) return;
  
  for(const id in magnets) {
    const magnet = magnets[id];
    const { r, g, b } = magnet.color;
    
    ctx.fillStyle = "#" + ((r << 16) + (g << 8) + b).toString(16).padStart(6, "0");
    ctx.strokeStyle = "1px solid black"
    ctx.beginPath();
    ctx.arc(magnet.x * canvas.width, magnet.y * canvas.height, magnetSize * pm.resolution, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  
  ctx.fillStyle = "#ddfbff";
  ctx.beginPath();
  ctx.arc(preview.x * canvas.width, preview.y * canvas.height, magnetSize * 0.75 * pm.resolution, 0, Math.PI * 2);
  ctx.fill();
}


function HSVtoRGB(h, s, v) {
  let r, g, b, i, f, p, q, t;
  i = Math.floor(h * 6);
  f = h * 6 - i;
  p = v * (1 - s);
  q = v * (1 - f * s);
  t = v * (1 - (1 - f) * s);
  switch(i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

canvas.addEventListener("click", ev => {
  const pos = {
    x: ev.offsetX / canvas.clientWidth,
    y: ev.offsetY / canvas.clientHeight,
  }
  
  if(ev.shiftKey) {
    let index = magnets.findIndex(m => dist(m, pos) < 0.01);
    if(index >= 0) {
      magnets.splice(index, 1);
    } else {
      magnets.push(pos);
    }
    
    for(const id in magnets) {
      magnets[id].color = HSVtoRGB(id / magnets.length, 1.0, 1.0);
    }
  } else {
    preview.x = pos.x;
    preview.y = pos.y;
    preview.vx = preview.vy = 0.0;
  }
  redraw();
})

generateBtn.addEventListener("click", async () => {
  if(generating) {
    generating = false
    return;
  }
  generating = true;
  
  generateBtn.innerText = "Stop";
  
  for(let y = 0; y < canvas.height; y++) {
    for(let x = 0; x < canvas.width; x++) {
      let pendulum = {
        x: (x + 0.5) / canvas.width,
        y: (y + 0.5) / canvas.height,
        vx: 0,
        vy: 0,
      };
      let stime = 0;
      let color = null;
      let i;
      
      for(i = 0; i < pm.maxSteps; i++) {
        simulate(pendulum);
        
        if(pendulum.vx ** 2 + pendulum.vy ** 2 < 0.001) {
          stime++;
          if(stime >= sleepSteps) {
            let minDist = 0.1;
            for(const m of magnets) {
              const d = dist(m, pendulum);
              if(d < minDist) {
                minDist = d;
                color = m.color;
              }
            }
            
            break;
          }
        } else {
          stime = 0;
        }
      }
      
      const offset = (x + y * background.width) * 4;
      if(color !== null) {
        const v = (1 - (i - sleepSteps) / (pm.maxSteps - sleepSteps)) ** 3;
        background.data[offset    ] = Math.round(color.r * v);
        background.data[offset + 1] = Math.round(color.g * v);
        background.data[offset + 2] = Math.round(color.b * v);
        background.data[offset + 3] = 255;
      } else {
        background.data[offset] = background.data[offset + 1] = background.data[offset + 2] = background.data[offset + 3] = 0;
      }
    }
  
    await new Promise(res => setTimeout(res, 0));
    if(!generating) break;
  }
  
  generateBtn.innerText = "Generate";
  generating = false;
})

for(let name in pm) {
  const input = document.getElementById(name);
  
  if(input.type === "checkbox") input.checked = pm[name];
  else input.value = pm[name];
  
  input.addEventListener("input", ev => {
    if(input.type === "checkbox") pm[name] = input.checked;
    else pm[name] = parseFloat(input.value);
    
    if(name === "resolution") resetCanvas();
  });
}
