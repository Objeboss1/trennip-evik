# Treeningpäevik

Kalender, treeningkava, lihased ja toitumine. Kontod ja päevikud salvestuvad firstadvice.ee PostgreSQL-i andmebaasi `firstadv_sport`, tabelisse `kasutajad`.

## Kohalik vaade

```bash
npm install
php -S 127.0.0.1:8081 -t .
npm run dev
```

Arenduses loeb `api/config.local.php` andmebaasi seaded. Serveris loeb `api/config.php`.

## Firstadvice

Laadi `npm run build` tulemus (`dist` kausta sisu) kausta `public_html`. Laadi kaust `api` kausta `public_html/api`. Kustuta vana `public_html/index.php`, et avaneks uus `index.html`. Andmebaasi parool kirjuta serveris faili `api/config.local.php`, mitte veebilehe koodi.
