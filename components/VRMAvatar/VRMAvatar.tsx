import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useAudioContext } from '../../logic/AudioProvider';

interface VRMAvatarProps {
  modelUrl?: string;
  width?: number;
  height?: number;
}

export const VRMAvatar: React.FC<VRMAvatarProps> = ({ 
  modelUrl = '/static/assets/6891a06aece5d61d2d726697.glb',
  width = 800,
  height = 600 
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const vrmRef = useRef<VRM | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const controlsRef = useRef<OrbitControls | null>(null);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelType, setModelType] = useState<'vrm' | 'glb'>('glb');
  
  // Get audio context for syncing with speech
  const { isAvatarTalking, isProcessingResponse } = useAudioContext();
  
  // Animation clips refs
  const idleClipRef = useRef<THREE.AnimationClip | null>(null);
  const talkingClipRef = useRef<THREE.AnimationClip | null>(null);
  const thinkingClipRef = useRef<THREE.AnimationClip | null>(null);

  // Load animations for GLB models
  const loadAnimationsForGLB = async () => {
    const loader = new GLTFLoader();
    
    try {
      // Load idle animation
      const idleGltf = await loader.loadAsync('/static/animations/idleMale.glb');
      if (idleGltf.animations.length > 0) {
        idleClipRef.current = idleGltf.animations[0];
        idleClipRef.current.name = 'idle';
      }
      
      // Load talking animation
      const talkingGltf = await loader.loadAsync('/static/animations/Talking.glb');
      if (talkingGltf.animations.length > 0) {
        talkingClipRef.current = talkingGltf.animations[0];
        talkingClipRef.current.name = 'talking';
      }
      
      // Load waving animation as alternative
      const wavingGltf = await loader.loadAsync('/static/animations/waving.glb');
      if (wavingGltf.animations.length > 0 && !talkingClipRef.current) {
        talkingClipRef.current = wavingGltf.animations[0];
        talkingClipRef.current.name = 'talking';
      }
      
      // Use idle as thinking for now
      thinkingClipRef.current = idleClipRef.current;
      
      console.log('✅ Animations loaded for GLB model');
    } catch (error) {
      console.warn('⚠️ Some animations failed to load:', error);
    }
  };

  // Retarget animation to model bones
  const retargetAnimation = (clip: THREE.AnimationClip, model: THREE.Object3D): THREE.AnimationClip => {
    const tracks: THREE.KeyframeTrack[] = [];
    
    clip.tracks.forEach((track) => {
      // Get the bone name from the track
      const parts = track.name.split('.');
      const boneName = parts[0];
      const property = parts.slice(1).join('.');
      
      // Try to find corresponding bone in the model
      let targetBone: THREE.Object3D | undefined;
      model.traverse((child) => {
        if (child.name === boneName || 
            child.name.toLowerCase().includes(boneName.toLowerCase()) ||
            boneName.toLowerCase().includes(child.name.toLowerCase())) {
          targetBone = child;
        }
      });
      
      if (targetBone) {
        // Create new track with the correct target
        const newTrack = track.clone();
        newTrack.name = `${targetBone.name}.${property}`;
        tracks.push(newTrack);
      }
    });
    
    return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
  };

  // Play animation
  const playAnimation = (clipName: 'idle' | 'talking' | 'thinking') => {
    if (!mixerRef.current || !modelRef.current) return;
    
    let clip: THREE.AnimationClip | null = null;
    
    switch (clipName) {
      case 'idle':
        clip = idleClipRef.current;
        break;
      case 'talking':
        clip = talkingClipRef.current;
        break;
      case 'thinking':
        clip = thinkingClipRef.current;
        break;
    }
    
    if (!clip) {
      console.warn(`Animation clip "${clipName}" not available`);
      return;
    }
    
    // Stop current animation with fade
    if (currentActionRef.current) {
      currentActionRef.current.fadeOut(0.5);
    }
    
    // Retarget animation for GLB models
    const targetClip = modelType === 'glb' ? retargetAnimation(clip, modelRef.current) : clip;
    
    // Play new animation
    const action = mixerRef.current.clipAction(targetClip);
    action.reset();
    action.fadeIn(0.5);
    action.play();
    currentActionRef.current = action;
    
    console.log(`🎬 Playing animation: ${clipName}`);
  };

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;
    
    // Detect model type from URL
    const isVRM = modelUrl.endsWith('.vrm');
    setModelType(isVRM ? 'vrm' : 'glb');
    
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      30,
      width / height,
      0.1,
      20
    );
    camera.position.set(0, 1.4, 3);
    cameraRef.current = camera;
    
    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    
    mountRef.current.appendChild(renderer.domElement);
    
    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI / 2;
    controls.update();
    controlsRef.current = controls;
    
    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1).normalize();
    scene.add(light);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // Grid helper
    const gridHelper = new THREE.GridHelper(10, 10);
    scene.add(gridHelper);
    
    // Load model
    const loader = new GLTFLoader();
    
    setIsLoading(true);
    setError(null);
    
    if (isVRM) {
      // Load as VRM
      loader.register((parser) => new VRMLoaderPlugin(parser));
      
      loader.load(
        modelUrl,
        async (gltf) => {
          const vrm = gltf.userData.vrm as VRM;
          
          // Rotate model if needed
          VRMUtils.rotateVRM0(vrm);
          
          scene.add(vrm.scene);
          vrmRef.current = vrm;
          modelRef.current = vrm.scene;
          
          // Create animation mixer
          mixerRef.current = new THREE.AnimationMixer(vrm.scene);
          
          // Load animations
          await loadAnimationsForGLB();
          
          // Start with idle animation
          playAnimation('idle');
          
          setIsLoading(false);
          console.log('✅ VRM model loaded successfully');
        },
        (progress) => {
          console.log('Loading VRM:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
        },
        (error) => {
          console.error('Error loading VRM:', error);
          setError('Failed to load VRM model');
          setIsLoading(false);
        }
      );
    } else {
      // Load as regular GLB
      loader.load(
        modelUrl,
        async (gltf) => {
          const model = gltf.scene;
          
          // Scale and position the model
          model.scale.set(1, 1, 1);
          model.position.set(0, 0, 0);
          
          // Center the model
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);
          model.position.y = 0;
          
          scene.add(model);
          modelRef.current = model;
          
          // Create animation mixer
          mixerRef.current = new THREE.AnimationMixer(model);
          
          // Use embedded animations if available
          if (gltf.animations && gltf.animations.length > 0) {
            console.log(`Found ${gltf.animations.length} embedded animations`);
            gltf.animations.forEach((clip, index) => {
              console.log(`Animation ${index}: ${clip.name}`);
              if (index === 0) idleClipRef.current = clip;
              if (index === 1) talkingClipRef.current = clip;
              if (index === 2) thinkingClipRef.current = clip;
            });
          }
          
          // Load external animations
          await loadAnimationsForGLB();
          
          // Start with idle animation
          playAnimation('idle');
          
          setIsLoading(false);
          console.log('✅ GLB model loaded successfully');
        },
        (progress) => {
          console.log('Loading GLB:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
        },
        (error) => {
          console.error('Error loading GLB:', error);
          setError('Failed to load GLB model');
          setIsLoading(false);
        }
      );
    }
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      const deltaTime = clockRef.current.getDelta();
      
      if (mixerRef.current) {
        mixerRef.current.update(deltaTime);
      }
      
      if (vrmRef.current) {
        vrmRef.current.update(deltaTime);
      }
      
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      renderer.render(scene, camera);
    };
    animate();
    
    // Cleanup
    return () => {
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [modelUrl, width, height]);
  
  // Sync animations with audio state
  useEffect(() => {
    if (isAvatarTalking) {
      playAnimation('talking');
    } else if (isProcessingResponse) {
      playAnimation('thinking');
    } else {
      playAnimation('idle');
    }
  }, [isAvatarTalking, isProcessingResponse]);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      
      const newWidth = mountRef.current?.clientWidth || width;
      const newHeight = mountRef.current?.clientHeight || height;
      
      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [width, height]);
  
  return (
    <div className="vrm-avatar-container relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading 3D Avatar...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 rounded-lg">
          <div className="text-center text-red-600">
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
      
      <div 
        ref={mountRef} 
        className="vrm-mount rounded-lg overflow-hidden"
        style={{ 
          width: width + 'px', 
          height: height + 'px',
          display: isLoading || error ? 'none' : 'block'
        }}
      />
      
      {/* Animation status indicator */}
      <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
        {isAvatarTalking ? '🎤 Speaking' : isProcessingResponse ? '🤔 Thinking' : '😊 Ready'}
      </div>
    </div>
  );
};