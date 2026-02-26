import { AdvancedSearchOptions, PaginationOptions } from './types';

export class SearchService {
  private worker: Worker | null = null;

  constructor() {
    // التأكد من البيئة قبل محاولة إنشاء الـ Worker
    if (typeof window !== 'undefined' && window.Worker) {
      try {
        // عادل اعترض على الـ URL، وضعناه في حاوية Try-Catch لضمان عدم انهيار التطبيق
        this.worker = new Worker(new URL('./search.worker.ts', import.meta.url), {
          type: 'module'
        });
      } catch (error) {
        console.error('Failed to instantiate search worker:', error);
        this.worker = null;
      }
    }
  }

  /**
   * (طلب عادل رقم 1): إضافة وظيفة لإنهاء الـ Worker وتحرير الذاكرة
   */
  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  async runSearch(
    query: string, 
    options: AdvancedSearchOptions = { lemma: false, root: false }, 
    pagination: PaginationOptions = { page: 1, limit: 10 }
  ): Promise<any> {
    
    if (this.worker) {
      const currentWorker = this.worker; 
      
      return new Promise((resolve, reject) => {
        const handler = (e: MessageEvent) => {
          if (e.data.type === 'SUCCESS') {
            resolve(e.data.results);
          } else {
            reject(e.data.error || e.data.message);
          }
          currentWorker.removeEventListener('message', handler);
        };

        currentWorker.addEventListener('message', handler);
        // إضافة onerror للتعامل مع أي مشكلة في الـ Worker نفسه
        currentWorker.onerror = (err) => {
          reject(err);
          currentWorker.removeEventListener('message', handler);
        };

        currentWorker.postMessage({ query, options, pagination });
      });
    } else {
      // Fallback في حال عدم توفر الـ Worker (SSR أو بيئة قديمة)
      const { search } = await import('./core/search');
      const { loadQuranData, loadMorphology, loadWordMap } = await import('./utils/loader');
      
      const [q, m, w] = await Promise.all([loadQuranData(), loadMorphology(), loadWordMap()]);
      
      return search(query, q, m, w, options, pagination);
    }
  }
}