import { AdvancedSearchOptions, PaginationOptions } from './types';

export class SearchService {
  private worker: Worker | null = null;
  constructor() {
    if (typeof window !== 'undefined' && window.Worker) {
      this.worker = new Worker(new URL('./search.worker.ts', import.meta.url), {
        type: 'module'
      });
    }
  }

  
  async runSearch(
    query: string, 
    options: AdvancedSearchOptions = { lemma: false, root: false }, 
    pagination: PaginationOptions = { page: 1, limit: 10 }
  ): Promise<any> {
    
    // حل مشكلة "Object is possibly null" باستخدام التحقق الشرطي
    if (this.worker) {
      const currentWorker = this.worker; // تثبيت المتغير محلياً للـ TypeScript
      
      return new Promise((resolve, reject) => {
        const handler = (e: MessageEvent) => {
          if (e.data.type === 'SUCCESS') {
            resolve(e.data.results);
          } else {
            reject(e.data.message);
          }
          currentWorker.removeEventListener('message', handler);
        };

        currentWorker.addEventListener('message', handler);
        currentWorker.postMessage({ query, options, pagination });
      });
    } else {
      // Fallback: استيراد الدوال ديناميكياً
      const { search } = await import('./core/search');
      const { loadQuranData, loadMorphology, loadWordMap } = await import('./utils/loader');
      
      const [q, m, w] = await Promise.all([loadQuranData(), loadMorphology(), loadWordMap()]);
      
      // هنا لن يظهر خطأ لأننا حددنا نوع options في بارامترات الدالة أعلاه
      return search(query, q, m, w, options, pagination);
    }
  }
}