import{r as e}from"./rolldown-runtime-hePW80VL.js";import{n as t}from"./vendor~index~MenuScene~LevelSelectScene~CharacterIntro~WallShatter~SceneManager-096o_Uk7.js";import{T as n,Tt as r,Ut as i,Xt as a,an as o,c as s,g as c,t as l,u}from"./vendor~MenuScene~LevelSelectScene~SceneManager-10zHvtz-.js";import{t as d}from"./vendor~LevelSelectScene~SceneManager-DO6MZAdw.js";var f=e(t()),p=parseInt(`185`.replace(/\D+/g,``)),m=f.forwardRef((e={enableDamping:!0},t)=>{let{domElement:n,camera:r,makeDefault:i,onChange:a,onStart:o,onEnd:c,...p}=e,m=u(e=>e.invalidate),h=u(e=>e.camera),g=u(e=>e.gl),_=u(e=>e.events),v=u(e=>e.set),y=u(e=>e.get),b=n||_.connected||g.domElement,x=r||h,S=f.useMemo(()=>new d(x),[x]);return f.useEffect(()=>{S.connect(b);let e=e=>{m(),a&&a(e)};return S.addEventListener(`change`,e),o&&S.addEventListener(`start`,o),c&&S.addEventListener(`end`,c),()=>{S.dispose(),S.removeEventListener(`change`,e),o&&S.removeEventListener(`start`,o),c&&S.removeEventListener(`end`,c)}},[a,o,c,S,m,b]),f.useEffect(()=>{if(i){let e=y().controls;return v({controls:S}),()=>v({controls:e})}},[i,S]),s(()=>S.update(),-1),f.createElement(`primitive`,l({ref:t,object:S,enableDamping:!0},p))});function h(e,t){let n=f.useRef(),[i]=f.useState(()=>t?t instanceof r?{current:t}:t:n),[a]=f.useState(()=>new c(void 0));f.useLayoutEffect(()=>{t&&(i.current=t instanceof r?t:t.current),a._root=i.current});let o=f.useRef({}),l=f.useMemo(()=>{let t={};return e.forEach(e=>Object.defineProperty(t,e.name,{enumerable:!0,get(){if(i.current)return o.current[e.name]||(o.current[e.name]=a.clipAction(e,i.current))},configurable:!0})),{ref:i,clips:e,actions:t,names:e.map(e=>e.name),mixer:a}},[e]);return s((e,t)=>a.update(t)),f.useEffect(()=>{let e=i.current;return()=>{o.current={},a.stopAllAction(),Object.values(l.actions).forEach(t=>{e&&a.uncacheAction(t,e)})}},[e]),l}var g=class extends i{constructor(){super({uniforms:{time:{value:0},fade:{value:1}},vertexShader:`
      uniform float time;
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 0.5);
        gl_PointSize = size * (30.0 / -mvPosition.z) * (3.0 + sin(time + 100.0));
        gl_Position = projectionMatrix * mvPosition;
      }`,fragmentShader:`
      uniform sampler2D pointTexture;
      uniform float fade;
      varying vec3 vColor;
      void main() {
        float opacity = 1.0;
        if (fade == 1.0) {
          float d = distance(gl_PointCoord, vec2(0.5, 0.5));
          opacity = 1.0 / (1.0 + exp(16.0 * (d - 0.25)));
        }
        gl_FragColor = vec4(vColor, opacity);

        #include <tonemapping_fragment>
	      #include <${p>=154?`colorspace_fragment`:`encodings_fragment`}>
      }`})}},_=e=>new o().setFromSpherical(new a(e,Math.acos(1-Math.random()*2),Math.random()*2*Math.PI)),v=f.forwardRef(({radius:e=100,depth:t=50,count:r=5e3,saturation:i=0,factor:a=4,fade:o=!1,speed:c=1},l)=>{let u=f.useRef(),[d,p,m]=f.useMemo(()=>{let o=[],s=[],c=Array.from({length:r},()=>(.5+.5*Math.random())*a),l=new n,u=e+t,d=t/r;for(let e=0;e<r;e++)u-=d*Math.random(),o.push(..._(u).toArray()),l.setHSL(e/r,i,.9),s.push(l.r,l.g,l.b);return[new Float32Array(o),new Float32Array(s),new Float32Array(c)]},[r,t,a,e,i]);s(e=>u.current&&(u.current.uniforms.time.value=e.clock.elapsedTime*c));let[h]=f.useState(()=>new g);return f.createElement(`points`,{ref:l},f.createElement(`bufferGeometry`,null,f.createElement(`bufferAttribute`,{attach:`attributes-position`,args:[d,3]}),f.createElement(`bufferAttribute`,{attach:`attributes-color`,args:[p,3]}),f.createElement(`bufferAttribute`,{attach:`attributes-size`,args:[m,1]})),f.createElement(`primitive`,{ref:u,object:h,attach:`material`,blending:2,"uniforms-fade-value":o,depthWrite:!1,transparent:!0,vertexColors:!0}))});export{h as n,m as r,v as t};