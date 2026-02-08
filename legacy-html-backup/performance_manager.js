/* ====================================================================== */
/* PERFORMANCE MANAGER - Optimierungen für schnelles Rendering           */
/* Virtual Scrolling, Lazy Loading, Debouncing, Caching                  */
/* ====================================================================== */

const PerformanceManager = (function() {
    'use strict';

    // =====================================================================
    // VIRTUAL SCROLLING FÜR GROSSE LISTEN
    // =====================================================================
    
    class VirtualScroller {
        constructor(container, options = {}) {
            this.container = container;
            this.items = [];
            this.itemHeight = options.itemHeight || 100;
            this.buffer = options.buffer || 5;
            this.renderItem = options.renderItem || ((item) => `<div>${JSON.stringify(item)}</div>`);
            
            this.viewport = null;
            this.content = null;
            this.visibleStart = 0;
            this.visibleEnd = 0;
            
            this.init();
        }
        
        init() {
            // Erstelle Viewport-Struktur
            this.container.innerHTML = `
                <div class="virtual-scroll-viewport" style="overflow-y: auto; height: 100%;">
                    <div class="virtual-scroll-content" style="position: relative;"></div>
                </div>
            `;
            
            this.viewport = this.container.querySelector('.virtual-scroll-viewport');
            this.content = this.container.querySelector('.virtual-scroll-content');
            
            // Event-Listener
            this.viewport.addEventListener('scroll', this.throttle(() => this.render(), 16));
            window.addEventListener('resize', this.debounce(() => this.render(), 150));
        }
        
        setItems(items) {
            this.items = items;
            this.content.style.height = `${items.length * this.itemHeight}px`;
            this.render();
        }
        
        render() {
            if (!this.viewport || !this.items.length) return;
            
            const scrollTop = this.viewport.scrollTop;
            const viewportHeight = this.viewport.clientHeight;
            
            // Berechne sichtbare Items
            this.visibleStart = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
            this.visibleEnd = Math.min(
                this.items.length,
                Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.buffer
            );
            
            // Rendere nur sichtbare Items
            const fragment = document.createDocumentFragment();
            const wrapper = document.createElement('div');
            wrapper.style.position = 'absolute';
            wrapper.style.top = `${this.visibleStart * this.itemHeight}px`;
            wrapper.style.width = '100%';
            
            for (let i = this.visibleStart; i < this.visibleEnd; i++) {
                const itemElement = document.createElement('div');
                itemElement.style.height = `${this.itemHeight}px`;
                itemElement.innerHTML = this.renderItem(this.items[i], i);
                wrapper.appendChild(itemElement);
            }
            
            fragment.appendChild(wrapper);
            this.content.innerHTML = '';
            this.content.appendChild(fragment);
        }
        
        throttle(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
        
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
        
        destroy() {
            this.viewport.removeEventListener('scroll', this.render);
            window.removeEventListener('resize', this.render);
        }
    }

    // =====================================================================
    // LAZY LOADING FÜR BILDER
    // =====================================================================
    
    class LazyImageLoader {
        constructor(options = {}) {
            this.rootMargin = options.rootMargin || '50px';
            this.threshold = options.threshold || 0.01;
            this.observer = null;
            
            if ('IntersectionObserver' in window) {
                this.init();
            }
        }
        
        init() {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        this.loadImage(entry.target);
                        this.observer.unobserve(entry.target);
                    }
                });
            }, {
                rootMargin: this.rootMargin,
                threshold: this.threshold
            });
        }
        
        observe(element) {
            if (this.observer) {
                this.observer.observe(element);
            } else {
                // Fallback: Sofort laden
                this.loadImage(element);
            }
        }
        
        loadImage(img) {
            const src = img.dataset.src;
            if (!src) return;
            
            // Erstelle temporäres Bild zum Vorladen
            const tempImg = new Image();
            tempImg.onload = () => {
                img.src = src;
                img.classList.add('loaded');
                img.removeAttribute('data-src');
            };
            tempImg.onerror = () => {
                img.classList.add('error');
                console.error('Failed to load image:', src);
            };
            tempImg.src = src;
        }
        
        destroy() {
            if (this.observer) {
                this.observer.disconnect();
            }
        }
    }

    // =====================================================================
    // REQUEST ANIMATION FRAME BATCHING
    // =====================================================================
    
    class RenderBatcher {
        constructor() {
            this.queue = [];
            this.isScheduled = false;
        }
        
        add(callback) {
            this.queue.push(callback);
            
            if (!this.isScheduled) {
                this.isScheduled = true;
                requestAnimationFrame(() => this.flush());
            }
        }
        
        flush() {
            const callbacks = [...this.queue];
            this.queue = [];
            this.isScheduled = false;
            
            callbacks.forEach(callback => {
                try {
                    callback();
                } catch (error) {
                    console.error('Render batch error:', error);
                }
            });
        }
    }

    // =====================================================================
    // MEMOIZATION/CACHING
    // =====================================================================
    
    class MemoCache {
        constructor(maxSize = 100) {
            this.cache = new Map();
            this.maxSize = maxSize;
        }
        
        get(key) {
            const stringKey = JSON.stringify(key);
            return this.cache.get(stringKey);
        }
        
        set(key, value) {
            const stringKey = JSON.stringify(key);
            
            // LRU: Lösche älteste wenn voll
            if (this.cache.size >= this.maxSize) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
            
            this.cache.set(stringKey, value);
        }
        
        has(key) {
            const stringKey = JSON.stringify(key);
            return this.cache.has(stringKey);
        }
        
        clear() {
            this.cache.clear();
        }
        
        size() {
            return this.cache.size;
        }
    }
    
    /**
     * Memoize-Wrapper für teure Berechnungen
     */
    function memoize(fn, cacheSize = 100) {
        const cache = new MemoCache(cacheSize);
        
        return function(...args) {
            if (cache.has(args)) {
                return cache.get(args);
            }
            
            const result = fn.apply(this, args);
            cache.set(args, result);
            return result;
        };
    }

    // =====================================================================
    // WEB WORKERS FÜR SCHWERE BERECHNUNGEN
    // =====================================================================
    
    class WorkerPool {
        constructor(workerScript, poolSize = 4) {
            this.workerScript = workerScript;
            this.poolSize = poolSize;
            this.workers = [];
            this.availableWorkers = [];
            this.taskQueue = [];
            
            this.init();
        }
        
        init() {
            for (let i = 0; i < this.poolSize; i++) {
                try {
                    const worker = new Worker(this.workerScript);
                    this.workers.push(worker);
                    this.availableWorkers.push(worker);
                } catch (error) {
                    console.error('Failed to create worker:', error);
                }
            }
        }
        
        async execute(data) {
            return new Promise((resolve, reject) => {
                const task = { data, resolve, reject };
                
                if (this.availableWorkers.length > 0) {
                    this.runTask(task);
                } else {
                    this.taskQueue.push(task);
                }
            });
        }
        
        runTask(task) {
            const worker = this.availableWorkers.shift();
            
            const onMessage = (event) => {
                worker.removeEventListener('message', onMessage);
                worker.removeEventListener('error', onError);
                
                this.availableWorkers.push(worker);
                task.resolve(event.data);
                
                // Nächste Task aus Queue
                if (this.taskQueue.length > 0) {
                    const nextTask = this.taskQueue.shift();
                    this.runTask(nextTask);
                }
            };
            
            const onError = (error) => {
                worker.removeEventListener('message', onMessage);
                worker.removeEventListener('error', onError);
                
                this.availableWorkers.push(worker);
                task.reject(error);
                
                // Nächste Task aus Queue
                if (this.taskQueue.length > 0) {
                    const nextTask = this.taskQueue.shift();
                    this.runTask(nextTask);
                }
            };
            
            worker.addEventListener('message', onMessage);
            worker.addEventListener('error', onError);
            worker.postMessage(task.data);
        }
        
        terminate() {
            this.workers.forEach(worker => worker.terminate());
            this.workers = [];
            this.availableWorkers = [];
            this.taskQueue = [];
        }
    }

    // =====================================================================
    // PROGRESSIVE LOADING
    // =====================================================================
    
    class ProgressiveLoader {
        constructor(items, batchSize = 20, delay = 100) {
            this.items = items;
            this.batchSize = batchSize;
            this.delay = delay;
            this.currentIndex = 0;
            this.isLoading = false;
            this.callbacks = {
                onBatch: null,
                onComplete: null
            };
        }
        
        start(onBatch, onComplete) {
            this.callbacks.onBatch = onBatch;
            this.callbacks.onComplete = onComplete;
            this.currentIndex = 0;
            this.loadNext();
        }
        
        loadNext() {
            if (this.isLoading) return;
            if (this.currentIndex >= this.items.length) {
                if (this.callbacks.onComplete) {
                    this.callbacks.onComplete();
                }
                return;
            }
            
            this.isLoading = true;
            
            const batch = this.items.slice(
                this.currentIndex,
                this.currentIndex + this.batchSize
            );
            
            if (this.callbacks.onBatch) {
                this.callbacks.onBatch(batch, this.currentIndex);
            }
            
            this.currentIndex += this.batchSize;
            this.isLoading = false;
            
            setTimeout(() => this.loadNext(), this.delay);
        }
        
        cancel() {
            this.currentIndex = this.items.length;
        }
    }

    // =====================================================================
    // PERFORMANCE MONITORING
    // =====================================================================
    
    class PerformanceMonitor {
        constructor() {
            this.marks = new Map();
            this.measures = [];
        }
        
        mark(name) {
            const time = performance.now();
            this.marks.set(name, time);
        }
        
        measure(name, startMark, endMark) {
            const start = this.marks.get(startMark);
            const end = endMark ? this.marks.get(endMark) : performance.now();
            
            if (start === undefined) {
                console.warn('Start mark not found:', startMark);
                return null;
            }
            
            const duration = end - start;
            this.measures.push({ name, duration, timestamp: Date.now() });
            
            return duration;
        }
        
        getMeasures() {
            return [...this.measures];
        }
        
        clearMarks() {
            this.marks.clear();
        }
        
        clearMeasures() {
            this.measures = [];
        }
        
        getStats() {
            if (this.measures.length === 0) return null;
            
            const durations = this.measures.map(m => m.duration);
            return {
                count: durations.length,
                total: durations.reduce((a, b) => a + b, 0),
                average: durations.reduce((a, b) => a + b, 0) / durations.length,
                min: Math.min(...durations),
                max: Math.max(...durations)
            };
        }
    }

    // =====================================================================
    // UTILITY FUNCTIONS
    // =====================================================================
    
    /**
     * Debounce Funktion
     */
    function debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Throttle Funktion
     */
    function throttle(func, limit = 100) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * Optimiert lange Listen mit Document Fragment
     */
    function renderListOptimized(container, items, renderItem) {
        const fragment = document.createDocumentFragment();
        
        items.forEach((item, index) => {
            const element = document.createElement('div');
            element.innerHTML = renderItem(item, index);
            fragment.appendChild(element.firstChild);
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
    }

    // =====================================================================
    // PUBLIC API
    // =====================================================================
    return {
        // Classes
        VirtualScroller,
        LazyImageLoader,
        RenderBatcher,
        MemoCache,
        WorkerPool,
        ProgressiveLoader,
        PerformanceMonitor,
        
        // Utilities
        debounce,
        throttle,
        memoize,
        renderListOptimized
    };
})();

// Globaler Export
window.PerformanceManager = PerformanceManager;
