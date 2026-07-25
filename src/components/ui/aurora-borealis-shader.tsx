'use client';

import { useEffect, useRef } from 'react';

/**
 * three.js 오로라 배경. three는 동적 import로 별도 청크 분리(로그인 화면 등에는 로드 안 됨).
 * 외부 네트워크 없음(GPU 렌더링). prefers-reduced-motion에서는 정지 프레임, 탭 숨김 시 정지.
 */
interface Props {
  /** 배경 투명도 (앱 뒤에 은은하게 깔 때 낮춘다) */
  opacity?: number;
  /** 마우스 플레어 상호작용(데스크톱). 기본 false */
  interactive?: boolean;
}

export function AuroraBorealisShader({ opacity = 1, interactive = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import('three');
      if (disposed || !containerRef.current) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const clock = new THREE.Clock();

      const vertexShader = `void main() { gl_Position = vec4(position, 1.0); }`;
      const fragmentShader = `
        precision highp float;
        uniform vec2 iResolution;
        uniform float iTime;
        uniform vec2 iMouse;
        float random(vec2 st){ return fract(sin(dot(st.xy, vec2(12.9898,78.233)))*43758.5453123); }
        float noise(vec2 p){
          vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(random(i),random(i+vec2(1.0,0.0)),u.x), mix(random(i+vec2(0.0,1.0)),random(i+vec2(1.0,1.0)),u.x), u.y);
        }
        float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; }
        void main(){
          vec2 uv=(gl_FragCoord.xy-0.5*iResolution.xy)/iResolution.y;
          vec2 mouse=(iMouse-0.5*iResolution.xy)/iResolution.y;
          float t=iTime*0.2;
          vec2 p=uv; p.y+=0.5;
          float f=fbm(vec2(p.x*2.0, p.y+t));
          float curtain=smoothstep(0.1,0.5,f)*(1.0-p.y);
          float d=length(uv-mouse);
          float flare=smoothstep(0.3,0.0,d);
          vec3 c1=vec3(0.1,0.8,0.5);
          vec3 c2=vec3(0.8,0.2,0.8);
          vec3 color=mix(c1,c2,p.y)*curtain;
          color+=vec3(1.0)*flare*curtain*2.0;
          gl_FragColor=vec4(color,1.0);
        }
      `;

      const uniforms = {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2() },
        iMouse: { value: new THREE.Vector2(-100, -100) },
      };
      const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      scene.add(mesh);

      const onResize = () => {
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        renderer.setSize(w, h);
        uniforms.iResolution.value.set(w, h);
      };
      window.addEventListener('resize', onResize);
      onResize();

      const onMouseMove = (e: MouseEvent) => {
        uniforms.iMouse.value.set(e.clientX, (container.clientHeight || window.innerHeight) - e.clientY);
      };
      if (interactive) window.addEventListener('mousemove', onMouseMove);

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const renderOnce = () => {
        uniforms.iTime.value = clock.getElapsedTime();
        renderer.render(scene, camera);
      };
      const onVis = () => {
        if (document.hidden) renderer.setAnimationLoop(null);
        else if (!reduced) renderer.setAnimationLoop(renderOnce);
      };
      document.addEventListener('visibilitychange', onVis);

      if (reduced) {
        uniforms.iTime.value = 6;
        renderer.render(scene, camera);
      } else {
        renderer.setAnimationLoop(renderOnce);
      }

      cleanup = () => {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('visibilitychange', onVis);
        renderer.setAnimationLoop(null);
        const el = renderer.domElement;
        if (el.parentNode) el.parentNode.removeChild(el);
        material.dispose();
        mesh.geometry.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [interactive]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: -10, pointerEvents: 'none', opacity }}
    />
  );
}

export default AuroraBorealisShader;
