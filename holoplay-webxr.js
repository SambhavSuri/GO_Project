/**
 * Looking Glass WebXR Integration
 * Direct browser integration for Looking Glass devices
 */

class LookingGlassWebXRPolyfill {
    constructor() {
        console.log('🚀 Looking Glass WebXR Polyfill constructing...');
        this.isLookingGlassAvailable = false;
        this.session = null;
        this.config = {
            targetX: 0,
            targetY: 0,
            targetZ: 0,
            targetDiam: 4.0,
            fovy: 30 * Math.PI / 180,
            depthiness: 1.5,
            nearPlane: 0.1,
            farPlane: 100.0
        };
        
        this.init();
    }
    
    async init() {
        // Check if Looking Glass Bridge is running
        try {
            await this.checkLookingGlassBridge();
            this.setupWebXRPolyfill();
        } catch (error) {
            console.warn('Looking Glass Bridge not detected:', error);
        }
    }
    
    async checkLookingGlassBridge() {
        // Try to connect to Looking Glass Bridge (usually runs on port 33334)
        try {
            const response = await fetch('http://localhost:33334/', { mode: 'no-cors' });
            this.isLookingGlassAvailable = true;
            return true;
        } catch (error) {
            // Try alternative detection methods
            const userAgent = navigator.userAgent.toLowerCase();
            const isLookingGlassUA = userAgent.includes('lookingglass') || userAgent.includes('holoplay');
            
            if (isLookingGlassUA) {
                this.isLookingGlassAvailable = true;
                return true;
            }
            
            throw new Error('Looking Glass Bridge not detected');
        }
    }
    
    setupWebXRPolyfill() {
        // Always create our custom XR implementation for Looking Glass
        const lookingGlassXR = new LookingGlassXRDevice();
        
        // Override or create navigator.xr
        navigator.xr = lookingGlassXR;
        
        console.log('✅ Looking Glass WebXR polyfill installed');
    }
    
    async createLookingGlassSession() {
        this.session = new LookingGlassXRSession(this.config);
        return this.session;
    }
}

class LookingGlassXRDevice {
    constructor() {
        this.sessions = [];
        console.log('🏗️ Looking Glass XR Device created');
    }
    
    async isSessionSupported(mode) {
        const supported = mode === 'immersive-vr';
        console.log(`🔍 Session support check for ${mode}: ${supported}`);
        return supported;
    }
    
    async requestSession(mode, options = {}) {
        console.log(`📱 Requesting session for mode: ${mode}`);
        if (mode === 'immersive-vr') {
            const session = new LookingGlassXRSession();
            this.sessions.push(session);
            console.log('✅ Looking Glass session created');
            return session;
        }
        console.error(`❌ Unsupported session mode: ${mode}`);
        throw new Error(`Unsupported session mode: ${mode}`);
    }
    
    // Add more XR API compatibility
    addEventListener(event, handler) {
        // Basic event handling
        console.log(`📡 Event listener added for: ${event}`);
    }
    
    removeEventListener(event, handler) {
        console.log(`📡 Event listener removed for: ${event}`);
    }
}

class LookingGlassXRSession extends EventTarget {
    constructor(config = {}) {
        super();
        this.mode = 'immersive-vr';
        this.visibilityState = 'visible';
        this.frameRequests = [];
        this.animationId = null;
        this.isActive = false;
        this.config = config;
        
        // Setup Looking Glass specific rendering
        this.setupLookingGlassRendering();
    }
    
    setupLookingGlassRendering() {
        // Create multiple camera views for holographic display
        this.views = this.createLookingGlassViews();
    }
    
    createLookingGlassViews() {
        const views = [];
        const numViews = 45; // Standard number of views for Looking Glass
        
        for (let i = 0; i < numViews; i++) {
            const angle = (i / (numViews - 1) - 0.5) * 0.5; // Viewing angle
            views.push(new LookingGlassXRView(i, angle, this.config));
        }
        
        return views;
    }
    
    requestAnimationFrame(callback) {
        if (!this.isActive) return;
        
        const frameId = this.frameRequests.length;
        this.frameRequests.push(callback);
        
        if (!this.animationId) {
            this.animationId = requestAnimationFrame(() => {
                this.processFrame();
            });
        }
        
        return frameId;
    }
    
    processFrame() {
        if (!this.isActive) return;
        
        const frame = new LookingGlassXRFrame(this);
        
        // Process all frame requests
        this.frameRequests.forEach(callback => {
            try {
                callback(0, frame); // timestamp, frame
            } catch (error) {
                console.error('XR frame callback error:', error);
            }
        });
        
        this.frameRequests = [];
        this.animationId = null;
        
        // Continue animation loop
        if (this.isActive) {
            this.animationId = requestAnimationFrame(() => {
                this.processFrame();
            });
        }
    }
    
    async end() {
        this.isActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Dispatch end event
        this.dispatchEvent(new Event('end'));
        
        console.log('Looking Glass session ended');
    }
    
    // Start the session
    start() {
        this.isActive = true;
        console.log('Looking Glass session started');
        
        // Dispatch session start event
        this.dispatchEvent(new Event('start'));
    }
}

class LookingGlassXRView {
    constructor(index, angle, config) {
        this.index = index;
        this.angle = angle;
        this.config = config;
        
        // Calculate projection matrix for this view
        this.projectionMatrix = this.calculateProjectionMatrix();
        this.transform = this.calculateViewTransform();
    }
    
    calculateProjectionMatrix() {
        const fov = this.config.fovy || (30 * Math.PI / 180);
        const aspect = window.innerWidth / window.innerHeight;
        const near = this.config.nearPlane || 0.1;
        const far = this.config.farPlane || 100;
        
        // Standard perspective projection matrix
        const f = 1.0 / Math.tan(fov / 2);
        const rangeInv = 1 / (near - far);
        
        return new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (near + far) * rangeInv, -1,
            0, 0, near * far * rangeInv * 2, 0
        ]);
    }
    
    calculateViewTransform() {
        // Calculate camera position for this view angle
        const baseDistance = 2.0;
        const lateralOffset = Math.sin(this.angle) * 0.1; // Small lateral movement
        
        return {
            position: { x: lateralOffset, y: 0, z: baseDistance },
            orientation: { x: 0, y: -this.angle * 0.1, z: 0, w: 1 }
        };
    }
}

class LookingGlassXRFrame {
    constructor(session) {
        this.session = session;
    }
    
    getViewerPose(referenceSpace) {
        return new LookingGlassXRViewerPose(this.session.views);
    }
}

class LookingGlassXRViewerPose {
    constructor(views) {
        this.views = views;
        this.transform = {
            position: { x: 0, y: 1.6, z: 0 }, // Standard eye height
            orientation: { x: 0, y: 0, z: 0, w: 1 }
        };
    }
}

// Export for use
window.LookingGlassWebXRPolyfill = LookingGlassWebXRPolyfill;

// Configuration object
window.LookingGlassConfig = {
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    targetDiam: 4.0,
    fovy: 30 * Math.PI / 180,
    depthiness: 1.5,
    nearPlane: 0.1,
    farPlane: 100.0
};

console.log('Looking Glass WebXR Polyfill loaded');
