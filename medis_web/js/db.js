const MedisDB = (() => {
  const DB_NAME = "MedisFilesDB";
  const STORE = "records";
  const VERSION = 1;

  function openDB(){
    return new Promise((resolve,reject)=>{
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if(!db.objectStoreNames.contains(STORE)){
          const store = db.createObjectStore(STORE,{keyPath:"id"});
          store.createIndex("userEmail","userEmail",{unique:false});
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(record){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAll(userEmail){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(STORE,"readonly");
      const req = tx.objectStore(STORE).index("userEmail").getAll(userEmail);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(id){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(STORE,"readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  return {put,getAll,remove};
})();