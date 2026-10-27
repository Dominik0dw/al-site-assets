# Univerzální díly – hlavní katalog, verze 3

Jeden HTML blok obsahuje hlavní stránku, skupiny kategorií, procházení podúrovní zdrojového stromu, vlastní výběr olejů a produktové výpisy ostatního sortimentu.

## Aktualizace na GitHubu

1. Rozbalte aktualizační ZIP.
2. Otevřete kořen repozitáře **dominik0dw/al-site-assets**. Zde vidíte složky `image-tec` a `STROM-UNI-DILU-NOVY`.
3. Zvolte **Add file → Upload files**.
4. Přetáhněte celou rozbalenou složku `STROM-UNI-DILU-NOVY` a potvrďte **Commit changes**.
5. Počkejte na dokončení publikování GitHub Pages.
6. V článku e-shopu nahraďte dosavadní blok tímto kódem:

```html
<div id="al-uni-mount"><p>Načítáme katalog univerzálních dílů…</p></div>
<script src="https://dominik0dw.github.io/al-site-assets/STROM-UNI-DILU-NOVY/assets/uni/uni.js?v=3" defer></script>
```

7. Uložte článek a obnovte stránku pomocí **Ctrl + F5**.

Přetahujte složku do kořene repozitáře, nikoliv do již otevřené stejnojmenné složky. Správná cesta obsahuje `STROM-UNI-DILU-NOVY` právě jednou.

Na jedné stránce použijte jeden nový blok. Samostatný původní blok olejů na témže článku odstraňte; výběr olejů je již uvnitř nového katalogu. Na jiném článku může původní blok dále fungovat.

Balíček navazuje na původně nahraný katalog. Nemění soubory `catalog/oleje/catalog.json` ani `catalog/oleje/overrides.json`, a tím zachovává vaši původní databázi a případné ruční opravy. Obsahuje i potřebné soubory vylepšení olejů v2, takže předchozí aktualizační ZIP nemusíte nahrávat zvlášť.

## Co zákazník uvidí

- Dvanáct hlavních oddílů a samostatné Akce a novinky.
- Levé menu, drobečkovou navigaci a přepínání dlaždic a seznamu.
- Hledání kategorií bez ohledu na diakritiku, zkratky a naposledy navštívené kategorie.
- Vlastní výběr olejů podle viskozity, ACEA, API, balení a dalších doložených parametrů.
- U dalších kategorií produkty, parametry dostupné ve zdroji, řazení skladem první, ceny bez DPH, dostupnost a napojení na původní košík.
- Mobilní nabídku kategorií a samostatně rozbalovací filtry.

Rozložení vychází z principů katalogu Auto Kelly. Barvy a obsah odpovídají Auto Lenc. Nejsou načítány žádné vlastní fonty.

## Dvanáct hlavních oddílů

| Oddíl | Původní hlavní větve |
| --- | --- |
| Oleje a maziva | 19058, 13114 |
| Provozní kapaliny | 19050, 6737 |
| Autobaterie | 19049 |
| Autochemie a aditiva | 19052, 13638, 13636, 13045 |
| Autokosmetika | 19054, 13041 |
| Lakování a karoserie | 19051 |
| Autopříslušenství | 19055, 16870, 16610, 13939, 18327 |
| Autoelektrika a osvětlení | 18169 |
| Nářadí a dílna | 19505, 20997, 6558, 13917 |
| Pneuservis | 19322 |
| Univerzální součástky | 19056, 6691 |
| Moto, kemping a zahrada | 20000, 13865, 18140 |

Akce a novinky používají větev 19057. Oddělovač 19223 a pracovní větev OLEJE TEST 20542 zůstávají v exportovaných datech, ale nejsou v zákaznickém menu. Značkové katalogy zůstávají pod příslušným oddílem. Shodný název různých větví neznamená, že obsahují stejné produkty, proto se jejich obsah neslučuje odhadem.

## Kde upravovat obsah

| Soubor | Účel |
| --- | --- |
| `assets/uni/config.json` | Hlavní oddíly, jejich pořadí, zdrojové větve, názvy a rychlé odkazy |
| `catalog/uni/tree.json` | Export skutečných kategorií a cest z e-shopu |
| `assets/uni/uni.css` | Vzhled hlavní stránky, kategorií a ostatních produktů |
| `assets/uni/uni.js` | Navigace, hledání, adresy s hashem a zapojení olejů |
| `assets/uni/native.js` | Načítání produktů, dostupných filtrů, cen a košíku z e-shopu |
| `assets/oleje/config.json` | Dosavadní nastavení výběru olejů |
| `catalog/oleje/overrides.json` | Dosavadní doložené ruční opravy specifikací olejů |

Úprava `groups` v konfiguraci mění jen zákaznické členění. `roots` obsahuje ID původních hlavních větví. Nepřepisujte tato čísla v samotném exportovaném stromu.

## Data a aktuálnost

Přiložená databáze obsahuje **4 051 kategorií** a všech **31 hlavních zdrojových větví**. U **1 585 větví** ještě nejsou jejich další potomci v souboru. Rozhraní je automaticky načte při rozkliknutí přímo z původního e-shopu; nedává tyto větve omylem do produktového výpisu. Velký zdrojový strom tedy není celý zkopírovaný na GitHub. Číselník obsahuje názvy, vztahy kategorií a původní odkazy.

Rychlé hledání prohledává již načtené kategorie. Tlačítko **Prohledat celý strom kategorií** vyvolá původní hledání e-shopu. Sdílený odkaz obsahuje i cestu k hluboké kategorii, aby ji šlo znovu načíst po otevření odkazu v jiném prohlížeči. Číslo položek na dlaždici je orientační stav při exportu, nikoliv počet právě skladem. Po otevření produktů se nabídka načítá z e-shopu.

Plně samostatná parametrická databáze je zatím u **812 olejových produktů**. U ostatního sortimentu se využívají parametry a filtry, které vrací původní e-shop. Chybějící specifikace se nevymýšlejí. Filtry s nulovým počtem se skrývají podle odpovědi zdroje; u olejů se počítají nad celou připravenou databází.

Nový výpis používá ceny bez DPH přímo ze zdroje. Ceny ani nákupní údaje zákazníků se neukládají na GitHub ani do místního úložiště prohlížeče. Živé odpovědi zůstávají krátkodobě v paměti otevřené stránky. Do místního úložiště se ukládá pouze zvolený vzhled a ID naposledy otevřených kategorií.

Tlačítko Do košíku používá existující funkci e-shopu a přesné údaje dodavatele u vybraného produktu. Pokud funkce není dostupná nebo se struktura zdroje změní, výpis nabízí detail produktu. Během přípravy nebyl odeslán skutečný požadavek na přidání zboží do živého košíku.

## Náhled a provoz

Po nahrání otevřete `STROM-UNI-DILU-NOVY/nahled-stromu.html` na GitHub Pages. Náhled umožňuje procházet připravenou část stromu a vlastní databázi olejů. Další podúrovně vyžadují vložení bloku přímo na e-shop; v náhledu na ně vede odkaz do původní kategorie. Živé ceny a košík fungují po vložení bloku na **https://eshop.auto-lenc.cz**; z GitHubu k nim brání přímému přístupu jiná doména.

Pro náhled na počítači spusťte ve složce projektu `python -m http.server 8000` a otevřete `http://localhost:8000/nahled-stromu.html`. Otevírání souboru dvojklikem není vhodné kvůli načítání JSON souborů.

Vizuální kontrola nového rozhraní v prohlížeči zde nebyla dokončena. Logika byla ověřena v DOM testech; vzhled na konkrétním článku a skutečný košík ověřte po nasazení.

## Obnovení stromu po změnách e-shopu

Jednorázově nainstalujte Python balíček `lxml`. Poté ve složce projektu spusťte:

```bash
python tools/refresh_tree.py
```

Skript obnoví `catalog/uni/tree.json`. Při chybě ponechá stávající export a uloží seznam chyb. Pro pokračování přidejte `--work-dir` s cestou pracovního adresáře z předchozího běhu. Nový běh bez tohoto parametru používá čerstvou mezipaměť.

Aktualizaci databáze olejů nadále zajišťuje `tools/refresh_catalog.py`. Strom kategorií a specifikace produktů se aktualizují samostatně. Po změně publikovaných souborů zvyšte parametr `v` u vstupního skriptu, aby se obnovily i navazující soubory.
