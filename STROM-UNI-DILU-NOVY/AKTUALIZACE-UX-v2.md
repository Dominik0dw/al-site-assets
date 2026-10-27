# Aktualizace rozhraní olejů – verze 2

Tento balíček obsahuje pouze změněné a nové soubory. Nahraje se do stávající složky `STROM-UNI-DILU-NOVY`.

1. Rozbalte ZIP na počítači.
2. V kořeni repozitáře `al-site-assets` zvolte **Add file → Upload files**.
3. Přetáhněte celou rozbalenou složku `STROM-UNI-DILU-NOVY` a potvrďte **Commit changes**. GitHub nahradí soubory se stejnou cestou; ostatní soubory zůstanou.
4. V HTML bloku e-shopu použijte celý následující kód:

```html
<div id="al-oils-mount"><p>Načítáme katalog olejů…</p></div>
<script src="https://dominik0dw.github.io/al-site-assets/STROM-UNI-DILU-NOVY/assets/oleje/oleje.js?v=2" defer></script>
```

Číslo `v=2` zajistí společné načtení nového JavaScriptu, CSS, konfigurace a pomocného skriptu.

## Změny

- Horní kategorie: motorové, převodové, ATF/CVT/DCT, motocyklové, nákladní vozy, zemědělská technika a další oleje.
- Výchozí řazení „Skladem první“ nad celým katalogem. Počáteční pořadí pochází z posledního známého přehledu a na pozadí se aktualizuje z e-shopu. Při selhání aktualizace je to ve stavovém řádku uvedeno.
- Filtry skrývají hodnoty bez výsledků i nerozlišující skupiny. Více zvolených norem se vyhodnocuje společně; nevzniká nabídka neslučitelných hodnot jen proto, že patří do stejného filtru.
- Cena bez DPH převzatá přímo z nativního pole e-shopu.
- Nové produktové karty s výraznou viskozitou a balením, oddělenou nákupní částí, tlačítky množství a ikonou chybějící fotografie.
- Hromadné načtení cen a skladu, okamžité použití již načtených cen po změně filtru a menší počáteční datový soubor. Ten má přibližně o 65 % méně bajtů než úplná databáze; rychlost první živé nabídky stále závisí na e-shopu.

Hlavní `catalog.json` a ruční `overrides.json` nejsou součástí aktualizace. Nový `index.json` je zmenšený výstup ze stejné databáze 812 produktů. Není potřeba přepisovat produktová data ani znovu stahovat detaily.

Kontroly pokryly návaznost filtrů, kategorie, globální pořadí skladu, cenu bez DPH proti nativnímu HTML, zachování cen, chybějící obrázek, množství a předání správného produktu funkci košíku. Skutečné vložení do živého košíku nebylo provedeno.
