import{r as e}from"./rolldown-runtime-hePW80VL.js";import{n as t}from"./vendor~index~LevelSelectScene~MenuScene~CharacterIntro~WallShatter~SceneManager-096o_Uk7.js";import{Jt as n,O as r,Qt as i,Rt as a,S as o,a as s,ct as c,ft as l,g as u,kt as d,o as f,r as p,st as m,t as h}from"./vendor~LevelSelectScene~MenuScene~SceneManager-DWrpu-fg.js";import{a as g,i as _,s as v}from"./vendor~LevelSelectScene~MenuScene-Jygap3ZI.js";var y=Object.defineProperty,b=(e,t,n)=>t in e?y(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n,x=(e,t,n)=>(b(e,typeof t==`symbol`?t:t+``,n),n),S=(()=>{let e={uniforms:{turbidity:{value:2},rayleigh:{value:1},mieCoefficient:{value:.005},mieDirectionalG:{value:.8},sunPosition:{value:new i},up:{value:new i(0,1,0)}},vertexShader:`
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
      #include <${v>=154?`colorspace_fragment`:`encodings_fragment`}>

      }
    `},t=new a({name:`SkyShader`,fragmentShader:e.fragmentShader,vertexShader:e.vertexShader,uniforms:n.clone(e.uniforms),side:1,depthWrite:!1});class r extends c{constructor(){super(new u(1,1,1),t)}}return x(r,`SkyShader`,e),x(r,`material`,t),r})(),C=e(t());function w(e,t,n=new i){let r=Math.PI*(e-.5),a=2*Math.PI*(t-.5);return n.x=Math.cos(a),n.y=Math.sin(r),n.z=Math.sin(a),n}var T=C.forwardRef(({inclination:e=.6,azimuth:t=.1,distance:n=1e3,mieCoefficient:r=.005,mieDirectionalG:a=.8,rayleigh:o=.5,turbidity:s=10,sunPosition:c=w(e,t),...l},u)=>{let d=C.useMemo(()=>new i().setScalar(n),[n]),[f]=C.useState(()=>new S);return C.createElement(`primitive`,h({object:f,ref:u,"material-uniforms-mieCoefficient-value":r,"material-uniforms-mieDirectionalG-value":a,"material-uniforms-rayleigh-value":o,"material-uniforms-sunPosition-value":c,"material-uniforms-turbidity-value":s,scale:d},l))}),E=`https://rawcdn.githack.com/pmndrs/drei-assets/9225a9f1fbd449d9411125c2f419b843d0308c9f/cloud.png`,D=new m,O=new i,k=new d,A=new i,j=new d,M=new i,N=C.createContext(null),P=C.forwardRef(({children:e,material:t=l,texture:n=E,range:a,limit:o=200,frustumCulled:c,...u},p)=>{let m=C.useMemo(()=>class extends t{constructor(){super();let e=parseInt(`185`.replace(/\D+/g,``))>=154?`opaque_fragment`:`output_fragment`;this.onBeforeCompile=t=>{t.vertexShader=`attribute float cloudOpacity;
               varying float vOpacity;
              `+t.vertexShader.replace(`#include <fog_vertex>`,`#include <fog_vertex>
                 vOpacity = cloudOpacity;
                `),t.fragmentShader=`varying float vOpacity;
              `+t.fragmentShader.replace(`#include <${e}>`,`#include <${e}>
                 gl_FragColor = vec4(outgoingLight, diffuseColor.a * vOpacity);
                `)}}},[t]);s({CloudMaterial:m});let v=C.useRef(null),y=C.useRef([]),b=C.useMemo(()=>new Float32Array(Array.from({length:o},()=>1)),[o]),x=C.useMemo(()=>new Float32Array(Array.from({length:o},()=>[1,1,1]).flat()),[o]),S=g(n),w=0,T=0,P,F=new d,I=new i(0,0,1),L=new i;f((e,t)=>{for(w=e.clock.elapsedTime,D.copy(v.current.matrixWorld).invert(),e.camera.matrixWorld.decompose(A,j,M),T=0;T<y.current.length;T++)P=y.current[T],P.ref.current.matrixWorld.decompose(O,k,M),O.add(L.copy(P.position).applyQuaternion(k).multiply(M)),k.copy(j).multiply(F.setFromAxisAngle(I,P.rotation+=t*P.rotationFactor)),M.multiplyScalar(P.volume+(1+Math.sin(w*P.density*P.speed))/2*P.growth),P.matrix.compose(O,k,M).premultiply(D),P.dist=O.distanceTo(A);for(y.current.sort((e,t)=>t.dist-e.dist),T=0;T<y.current.length;T++)P=y.current[T],b[T]=P.opacity*(P.dist<P.fade-1?P.dist/P.fade:1),v.current.setMatrixAt(T,P.matrix),v.current.setColorAt(T,P.color);v.current.geometry.attributes.cloudOpacity.needsUpdate=!0,v.current.instanceMatrix.needsUpdate=!0,v.current.instanceColor&&(v.current.instanceColor.needsUpdate=!0)}),C.useLayoutEffect(()=>{let e=Math.min(o,a===void 0?o:a,y.current.length);v.current.count=e,_(v.current.instanceMatrix,{offset:0,count:e*16}),v.current.instanceColor&&_(v.current.instanceColor,{offset:0,count:e*3}),_(v.current.geometry.attributes.cloudOpacity,{offset:0,count:e})});let R=[S.image.width??1,S.image.height??1],z=Math.max(R[0],R[1]);return R=[R[0]/z,R[1]/z],C.createElement(`group`,h({ref:p},u),C.createElement(N.Provider,{value:y},e,C.createElement(`instancedMesh`,{matrixAutoUpdate:!1,ref:v,args:[null,null,o],frustumCulled:c},C.createElement(`instancedBufferAttribute`,{usage:r,attach:`instanceColor`,args:[x,3]}),C.createElement(`planeGeometry`,{args:[...R]},C.createElement(`instancedBufferAttribute`,{usage:r,attach:`attributes-cloudOpacity`,args:[b,1]})),C.createElement(`cloudMaterial`,{key:t.name,map:S,transparent:!0,depthWrite:!1}))))}),F=C.forwardRef(({opacity:e=1,speed:t=0,bounds:n=[5,1,1],segments:r=20,color:a=`#ffffff`,fade:s=10,volume:c=6,smallestVolume:l=.25,distribute:u=null,growth:d=4,concentrate:f=`inside`,seed:g=Math.random(),..._},v)=>{function y(){let e=Math.sin(g++)*1e4;return e-Math.floor(e)}let b=C.useContext(N),x=C.useRef(null),S=C.useId(),w=C.useMemo(()=>[...Array(r)].map((e,t)=>({segments:r,bounds:new i(1,1,1),position:new i,uuid:S,index:t,ref:x,dist:0,matrix:new m,color:new o,rotation:Math.PI/r*t})),[r,S]);return C.useLayoutEffect(()=>{w.forEach((i,o)=>{p(i,{volume:c,color:a,speed:t,growth:d,opacity:e,fade:s,bounds:n,density:Math.max(.5,y()),rotationFactor:Math.max(.2,.5*y())*t});let m=u?.(i,o);(m||r>1)&&i.position.copy(i.bounds).multiply(m?.point??{x:y()*2-1,y:y()*2-1,z:y()*2-1});let h=Math.abs(i.position.x),g=Math.abs(i.position.y),_=Math.abs(i.position.z),v=Math.max(h,g,_);i.length=1,h===v&&(i.length-=h/i.bounds.x),g===v&&(i.length-=g/i.bounds.y),_===v&&(i.length-=_/i.bounds.z),i.volume=(m?.volume===void 0?Math.max(Math.max(0,l),f===`random`?y():f===`inside`?i.length:1-i.length):m.volume)*c})},[f,n,s,a,e,d,c,g,r,t]),C.useLayoutEffect(()=>{let e=w;return b.current=[...b.current,...e],()=>{b.current=b.current.filter(e=>e.uuid!==S)}},[w]),C.useImperativeHandle(v,()=>x.current,[]),C.createElement(`group`,h({ref:x},_))}),I=C.forwardRef((e,t)=>C.useContext(N)?C.createElement(F,h({ref:t},e)):C.createElement(P,null,C.createElement(F,h({ref:t},e))));export{P as n,T as r,I as t};