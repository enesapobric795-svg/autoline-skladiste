import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://usdehsqsoupmjoyzjzhy.supabase.co"; 
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzZGVoc3Fzb3VwbWpveXpqemh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjIxMDA3OSwiZXhwIjoyMDk3Nzg2MDc5fQ.5coC8GvXXENQ2iOJuxPG7VUEPMHy36Qay0j5mDB_Lds"; 

const supabase = createClient(supabaseUrl, supabaseKey);

// Pomoćna funkcija za pauzu da ne ugušimo API
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runSyncSafe() {
  const pojmovi = ["filter", "ulje", "disk", "pločice", "amortizer", "set", "kvačila", "zamajac", "turbina", "dizna", "pumpa", "far", "branik", "hladnjak", "viljuška", "remen", "audi", "bmw", "golf", "passat", "opel", "fiat", "renault", "ford", "skoda", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "r", "s", "t", "u", "v", "z"];
  const olxUsername = "AutoLINE1";

  console.log(`Pokrećem sigurnu sinkronizaciju za ${pojmovi.length} pojmova...`);

  for (let i = 0; i < pojmovi.length; i++) {
    const pojam = pojmovi[i];
    console.log(`\n➡️ [${i + 1}/${pojmovi.length}] Tražim pojam: "${pojam}"`);
    
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const url = `https://api.olx.ba/users/${olxUsername}/listings?q=${encodeURIComponent(pojam)}&page=${page}`;
        
        // Timeout zaštita od 7 sekundi da se skripta nikad ne zaglavi
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'OLX-CLIENT-ID': "5285154938",
            'OLX-CLIENT-TOKEN': "Q05OE6kiWm1fffaP0F1kNRBZIYq5sf"
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const result = await response.json();
        const listings = result.data;

        if (!listings || listings.length === 0) {
          break;
        }

        process.stdout.write(`Stranica ${page} (${listings.length} kom)... `);

        for (const item of listings) {
          const artikalZaBazu = {
            olx_id: item.id,
            naziv: item.title,
            cijena: item.price || 0,
            slika: item.image || null
          };

          await supabase.from('dijelovi').upsert(artikalZaBazu, { onConflict: 'olx_id' });
        }

        if (listings.length < 20) {
          hasMore = false;
        } else {
          page++;
        }

        // Mala pauza od 300 milisekundi između stranica da odmorimo vezu
        await sleep(300);

      } catch (err) {
        console.log(`[Veza prekinuta/Timeout na stranici ${page}, idem dalje...]`);
        break;
      }
    }
  }

  console.log("\nSve gotovo! Provjerite bazu.");
}

runSyncSafe();