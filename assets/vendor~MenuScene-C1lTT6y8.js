import{r as e}from"./rolldown-runtime-hePW80VL.js";import{n as t}from"./vendor~index~MenuScene~CharacterIntro~WallShatter~LevelSelectScene~SceneManager-096o_Uk7.js";import{D as n,Gt as r,Kt as i,Lt as a,Ot as o,Zt as s,a as c,c as l,dt as u,g as d,o as f,ot as p,qt as m,r as h,s as g,st as _,t as v,x as y}from"./vendor~MenuScene~LevelSelectScene~SceneManager-CnZxTUUM.js";import{a as b,r as x}from"./vendor~MenuScene~LevelSelectScene-BBqmRuca.js";var S=Object.defineProperty,C=(e,t,n)=>t in e?S(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n,w=(e,t,n)=>(C(e,typeof t==`symbol`?t:t+``,n),n),T=(()=>{let e={uniforms:{turbidity:{value:2},rayleigh:{value:1},mieCoefficient:{value:.005},mieDirectionalG:{value:.8},sunPosition:{value:new s},up:{value:new s(0,1,0)}},vertexShader:`
      uniform vec3 sunPosition;
      uniform float rayleigh;
      uniform float turbidity;
      uniform float mieCoefficient;
      uniform vec3 up;

      varying vec3 vWorldPosition;
      varying vec3 vSunDirection;
      varying float vSunfade;
      varying vec3 vBetaR;
      varying vec3 vBetaM;
      varying float vSunE;

      // constants for atmospheric scattering
      const float e = 2.71828182845904523536028747135266249775724709369995957;
      const float pi = 3.141592653589793238462643383279502884197169;

      // wavelength of used primaries, according to preetham
      const vec3 lambda = vec3( 680E-9, 550E-9, 450E-9 );
      // this pre-calcuation replaces older TotalRayleigh(vec3 lambda) function:
      // (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn))
      const vec3 totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );

      // mie stuff
      // K coefficient for the primaries
      const float v = 4.0;
      const vec3 K = vec3( 0.686, 0.678, 0.666 );
      // MieConst = pi * pow( ( 2.0 * pi ) / lambda, vec3( v - 2.0 ) ) * K
      const vec3 MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );

      // earth shadow hack
      // cutoffAngle = pi / 1.95;
      const float cutoffAngle = 1.6110731556870734;
      const float steepness = 1.5;
      const float EE = 1000.0;

      float sunIntensity( float zenithAngleCos ) {
        zenithAngleCos = clamp( zenithAngleCos, -1.0, 1.0 );
        return EE * max( 0.0, 1.0 - pow( e, -( ( cutoffAngle - acos( zenithAngleCos ) ) / steepness ) ) );
      }

      vec3 totalMie( float T ) {
        float c = ( 0.2 * T ) * 10E-18;
        return 0.434 * c * MieConst;
      }

      void main() {

        vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
        vWorldPosition = worldPosition.xyz;

        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        gl_Position.z = gl_Position.w; // set z to camera.far

        vSunDirection = normalize( sunPosition );

        vSunE = sunIntensity( dot( vSunDirection, up ) );

        vSunfade = 1.0 - clamp( 1.0 - exp( ( sunPosition.y / 450000.0 ) ), 0.0, 1.0 );

        float rayleighCoefficient = rayleigh - ( 1.0 * ( 1.0 - vSunfade ) );

      // extinction (absorbtion + out scattering)
      // rayleigh coefficients
        vBetaR = totalRayleigh * rayleighCoefficient;

      // mie coefficients
        vBetaM = totalMie( turbidity ) * mieCoefficient;

      }
    `,fragmentShader:`
      varying vec3 vWorldPosition;
      varying vec3 vSunDirection;
      varying float vSunfade;
      varying vec3 vBetaR;
      varying vec3 vBetaM;
      varying float vSunE;

      uniform float mieDirectionalG;
      uniform vec3 up;

      const vec3 cameraPos = vec3( 0.0, 0.0, 0.0 );

      // constants for atmospheric scattering
      const float pi = 3.141592653589793238462643383279502884197169;

      const float n = 1.0003; // refractive index of air
      const float N = 2.545E25; // number of molecules per unit volume for air at 288.15K and 1013mb (sea level -45 celsius)

      // optical length at zenith for molecules
      const float rayleighZenithLength = 8.4E3;
      const float mieZenithLength = 1.25E3;
      // 66 arc seconds -> degrees, and the cosine of that
      const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;

      // 3.0 / ( 16.0 * pi )
      const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
      // 1.0 / ( 4.0 * pi )
      const float ONE_OVER_FOURPI = 0.07957747154594767;

      float rayleighPhase( float cosTheta ) {
        return THREE_OVER_SIXTEENPI * ( 1.0 + pow( cosTheta, 2.0 ) );
      }

      float hgPhase( float cosTheta, float g ) {
        float g2 = pow( g, 2.0 );
        float inverse = 1.0 / pow( 1.0 - 2.0 * g * cosTheta + g2, 1.5 );
        return ONE_OVER_FOURPI * ( ( 1.0 - g2 ) * inverse );
      }

      void main() {

        vec3 direction = normalize( vWorldPosition - cameraPos );

      // optical length
      // cutoff angle at 90 to avoid singularity in next formula.
        float zenithAngle = acos( max( 0.0, dot( up, direction ) ) );
        float inverse = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / pi ), -1.253 ) );
        float sR = rayleighZenithLength * inverse;
        float sM = mieZenithLength * inverse;

      // combined extinction factor
        vec3 Fex = exp( -( vBetaR * sR + vBetaM * sM ) );

      // in scattering
        float cosTheta = dot( direction, vSunDirection );

        float rPhase = rayleighPhase( cosTheta * 0.5 + 0.5 );
        vec3 betaRTheta = vBetaR * rPhase;

        float mPhase = hgPhase( cosTheta, mieDirectionalG );
        vec3 betaMTheta = vBetaM * mPhase;

        vec3 Lin = pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );
        Lin *= mix( vec3( 1.0 ), pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * Fex, vec3( 1.0 / 2.0 ) ), clamp( pow( 1.0 - dot( up, vSunDirection ), 5.0 ), 0.0, 1.0 ) );

      // nightsky
        float theta = acos( direction.y ); // elevation --> y-axis, [-pi/2, pi/2]
        float phi = atan( direction.z, direction.x ); // azimuth --> x-axis [-pi/2, pi/2]
        vec2 uv = vec2( phi, theta ) / vec2( 2.0 * pi, pi ) + vec2( 0.5, 0.0 );
        vec3 L0 = vec3( 0.1 ) * Fex;

      // composition + solar disc
        float sundisk = smoothstep( sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta );
        L0 += ( vSunE * 19000.0 * Fex ) * sundisk;

        vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );

        vec3 retColor = pow( texColor, vec3( 1.0 / ( 1.2 + ( 1.2 * vSunfade ) ) ) );

        gl_FragColor = vec4( retColor, 1.0 );

      #include <tonemapping_fragment>
      #include <${b>=154?`colorspace_fragment`:`encodings_fragment`}>

      }
    `},t=new a({name:`SkyShader`,fragmentShader:e.fragmentShader,vertexShader:e.vertexShader,uniforms:m.clone(e.uniforms),side:1,depthWrite:!1});class n extends _{constructor(){super(new d(1,1,1),t)}}return w(n,`SkyShader`,e),w(n,`material`,t),n})(),E=e(t()),D=e=>e===Object(e)&&!Array.isArray(e)&&typeof e!=`function`;function O(e,t){let n=l(e=>e.gl),a=g(i,D(e)?Object.values(e):e);return(0,E.useLayoutEffect)(()=>{t?.(a)},[t]),(0,E.useEffect)(()=>{if(`initTexture`in n){let e=[];Array.isArray(a)?e=a:a instanceof r?e=[a]:D(a)&&(e=Object.values(a)),e.forEach(e=>{e instanceof r&&n.initTexture(e)})}},[n,a]),(0,E.useMemo)(()=>{if(D(e)){let t={},n=0;for(let r in e)t[r]=a[n++];return t}return a},[e,a])}O.preload=e=>g.preload(i,e),O.clear=e=>g.clear(i,e);function k(e,t,n=new s){let r=Math.PI*(e-.5),i=2*Math.PI*(t-.5);return n.x=Math.cos(i),n.y=Math.sin(r),n.z=Math.sin(i),n}var A=E.forwardRef(({inclination:e=.6,azimuth:t=.1,distance:n=1e3,mieCoefficient:r=.005,mieDirectionalG:i=.8,rayleigh:a=.5,turbidity:o=10,sunPosition:c=k(e,t),...l},u)=>{let d=E.useMemo(()=>new s().setScalar(n),[n]),[f]=E.useState(()=>new T);return E.createElement(`primitive`,v({object:f,ref:u,"material-uniforms-mieCoefficient-value":r,"material-uniforms-mieDirectionalG-value":i,"material-uniforms-rayleigh-value":a,"material-uniforms-sunPosition-value":c,"material-uniforms-turbidity-value":o,scale:d},l))}),j=`https://rawcdn.githack.com/pmndrs/drei-assets/9225a9f1fbd449d9411125c2f419b843d0308c9f/cloud.png`,M=new p,N=new s,P=new o,F=new s,I=new o,L=new s,R=E.createContext(null),z=E.forwardRef(({children:e,material:t=u,texture:r=j,range:i,limit:a=200,frustumCulled:l,...d},p)=>{let m=E.useMemo(()=>class extends t{constructor(){super();let e=parseInt(`185`.replace(/\D+/g,``))>=154?`opaque_fragment`:`output_fragment`;this.onBeforeCompile=t=>{t.vertexShader=`attribute float cloudOpacity;
               varying float vOpacity;
              `+t.vertexShader.replace(`#include <fog_vertex>`,`#include <fog_vertex>
                 vOpacity = cloudOpacity;
                `),t.fragmentShader=`varying float vOpacity;
              `+t.fragmentShader.replace(`#include <${e}>`,`#include <${e}>
                 gl_FragColor = vec4(outgoingLight, diffuseColor.a * vOpacity);
                `)}}},[t]);c({CloudMaterial:m});let h=E.useRef(null),g=E.useRef([]),_=E.useMemo(()=>new Float32Array(Array.from({length:a},()=>1)),[a]),y=E.useMemo(()=>new Float32Array(Array.from({length:a},()=>[1,1,1]).flat()),[a]),b=O(r),S=0,C=0,w,T=new o,D=new s(0,0,1),k=new s;f((e,t)=>{for(S=e.clock.elapsedTime,M.copy(h.current.matrixWorld).invert(),e.camera.matrixWorld.decompose(F,I,L),C=0;C<g.current.length;C++)w=g.current[C],w.ref.current.matrixWorld.decompose(N,P,L),N.add(k.copy(w.position).applyQuaternion(P).multiply(L)),P.copy(I).multiply(T.setFromAxisAngle(D,w.rotation+=t*w.rotationFactor)),L.multiplyScalar(w.volume+(1+Math.sin(S*w.density*w.speed))/2*w.growth),w.matrix.compose(N,P,L).premultiply(M),w.dist=N.distanceTo(F);for(g.current.sort((e,t)=>t.dist-e.dist),C=0;C<g.current.length;C++)w=g.current[C],_[C]=w.opacity*(w.dist<w.fade-1?w.dist/w.fade:1),h.current.setMatrixAt(C,w.matrix),h.current.setColorAt(C,w.color);h.current.geometry.attributes.cloudOpacity.needsUpdate=!0,h.current.instanceMatrix.needsUpdate=!0,h.current.instanceColor&&(h.current.instanceColor.needsUpdate=!0)}),E.useLayoutEffect(()=>{let e=Math.min(a,i===void 0?a:i,g.current.length);h.current.count=e,x(h.current.instanceMatrix,{offset:0,count:e*16}),h.current.instanceColor&&x(h.current.instanceColor,{offset:0,count:e*3}),x(h.current.geometry.attributes.cloudOpacity,{offset:0,count:e})});let A=[b.image.width??1,b.image.height??1],z=Math.max(A[0],A[1]);return A=[A[0]/z,A[1]/z],E.createElement(`group`,v({ref:p},d),E.createElement(R.Provider,{value:g},e,E.createElement(`instancedMesh`,{matrixAutoUpdate:!1,ref:h,args:[null,null,a],frustumCulled:l},E.createElement(`instancedBufferAttribute`,{usage:n,attach:`instanceColor`,args:[y,3]}),E.createElement(`planeGeometry`,{args:[...A]},E.createElement(`instancedBufferAttribute`,{usage:n,attach:`attributes-cloudOpacity`,args:[_,1]})),E.createElement(`cloudMaterial`,{key:t.name,map:b,transparent:!0,depthWrite:!1}))))}),B=E.forwardRef(({opacity:e=1,speed:t=0,bounds:n=[5,1,1],segments:r=20,color:i=`#ffffff`,fade:a=10,volume:o=6,smallestVolume:c=.25,distribute:l=null,growth:u=4,concentrate:d=`inside`,seed:f=Math.random(),...m},g)=>{function _(){let e=Math.sin(f++)*1e4;return e-Math.floor(e)}let b=E.useContext(R),x=E.useRef(null),S=E.useId(),C=E.useMemo(()=>[...Array(r)].map((e,t)=>({segments:r,bounds:new s(1,1,1),position:new s,uuid:S,index:t,ref:x,dist:0,matrix:new p,color:new y,rotation:Math.PI/r*t})),[r,S]);return E.useLayoutEffect(()=>{C.forEach((s,f)=>{h(s,{volume:o,color:i,speed:t,growth:u,opacity:e,fade:a,bounds:n,density:Math.max(.5,_()),rotationFactor:Math.max(.2,.5*_())*t});let p=l?.(s,f);(p||r>1)&&s.position.copy(s.bounds).multiply(p?.point??{x:_()*2-1,y:_()*2-1,z:_()*2-1});let m=Math.abs(s.position.x),g=Math.abs(s.position.y),v=Math.abs(s.position.z),y=Math.max(m,g,v);s.length=1,m===y&&(s.length-=m/s.bounds.x),g===y&&(s.length-=g/s.bounds.y),v===y&&(s.length-=v/s.bounds.z),s.volume=(p?.volume===void 0?Math.max(Math.max(0,c),d===`random`?_():d===`inside`?s.length:1-s.length):p.volume)*o})},[d,n,a,i,e,u,o,f,r,t]),E.useLayoutEffect(()=>{let e=C;return b.current=[...b.current,...e],()=>{b.current=b.current.filter(e=>e.uuid!==S)}},[C]),E.useImperativeHandle(g,()=>x.current,[]),E.createElement(`group`,v({ref:x},m))}),V=E.forwardRef((e,t)=>E.useContext(R)?E.createElement(B,v({ref:t},e)):E.createElement(z,null,E.createElement(B,v({ref:t},e))));export{z as n,A as r,V as t};