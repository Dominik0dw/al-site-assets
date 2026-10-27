# Katalog olejů Auto Lenc

## Nahrání na GitHub

Projekt je uložený ve složce `STROM-UNI-DILU-NOVY` v repozitáři `al-site-assets`. Aktualizační ZIP obsahuje jen změněné a nové soubory v této složce. Rozbalte jej a složku přetáhněte do `Add file → Upload files` z kořene repozitáře. GitHub aktualizuje shodné cesty. Zachovejte názvy a vnoření složek.

Pokud už máte vlastní `.gitignore`, přidejte do něj jen uvedená pravidla pro cache a Python. Úvodní stránku ani původní README tento balíček nenahrazuje.

| Soubor / složka | Účel |
| --- | --- |
| `assets/oleje/oleje.js` | Rozhraní katalogu, hledání, filtry, stránkování a hash v adrese |
| `assets/oleje/oleje.css` | Vzhled celého bloku; přebírá písmo e-shopu |
| `assets/oleje/live.js` | Načtení ceny a dostupnosti a napojení na nativní košík |
| `assets/oleje/config.json` | Názvy, filtry, poradci, počet produktů na stránce |
| `catalog/oleje/catalog.json` | Produkty a jejich parametry s uvedenými zdroji |
| `catalog/oleje/index.json` | Menší soubor pro první načtení rozhraní, odvozený z hlavní databáze |
| `catalog/oleje/availability-order.json` | Poslední známé pořadí skladu pro okamžité počáteční řazení; bez cen a množství |
| `catalog/oleje/overrides.json` | Ručně ověřené opravy; obnovovací skript je nepřepisuje |
| `catalog/oleje/audit.json` | Pokrytí parametrů a položky k doplnění |
| `catalog/oleje/ke-kontrole.csv` | Přehled chybějících parametrů pro tabulkový editor |
| `tools/` | Obnova databáze a ověřovací skripty; nejsou potřeba k běhu |
| `vlozit-do-eshopu.html` | Celý krátký kód pro HTML blok v e-shopu |
| `nahled-oleju.html` | Samostatný náhled rozhraní; nepotřebuje měnit úvodní stránku repozitáře |

V GitHub Pages musí být publikovaný kořen tohoto repozitáře. Po nahrání má být dostupný soubor:

https://dominik0dw.github.io/al-site-assets/STROM-UNI-DILU-NOVY/assets/oleje/oleje.js

Do článku e-shopu vložte obsah `vlozit-do-eshopu.html`. Nepoužívejte iframe: cena, sklad i košík potřebují běžet přímo na doméně e-shopu. Skript má být vložený jednou.

## Co zákazník uvidí

Nahoře jsou kategorie dostupných olejů, vlevo provázané filtry. Kategorie lze upravovat v poli `categories` v `config.json`. Klasifikace vychází z produktových řad; nové řady bez pravidla spadají do „Další oleje“. Rychlý výběr viskozity ukazuje jen dostupné hodnoty. Poradci jsou pod rozbalovacím odkazem. Produkty mají výraznou viskozitu a balení, cenu bez DPH, dostupnost a množství s tlačítky plus/minus. Chybějící nebo nefunkční obrázek nahrazuje ikona. Na mobilu lze filtry rozbalit tlačítkem.

Hledání a filtry pracují nad celou staženou databází. Více výrobců nebo balení se kombinuje jako „nebo“. Více schválení či specifikací jako „a zároveň“. Hodnoty bez odpovídajícího produktu se nenabízejí; u kombinovaných norem se počítá i s již vybranými hodnotami téže normy. Filtr s jedinou hodnotou společnou všem výsledkům se skryje. Již zvolené hodnoty zůstávají dostupné k odškrtnutí. Výběr včetně kategorie a řazení se zapisuje do hashe `#oil=…` a lze jej sdílet.

## Ceny, sklad a košík

Výchozí řazení je „Skladem první“ nad celým katalogem. První zobrazení využije poslední známý index pořadí a současně požádá nativní službu e-shopu o úplný aktuální přehled skladových nabídek dané větve. Po odpovědi se pořadí aktualizuje. Rozlišují se nabídky označené e-shopem jako skladem, ostatní dostupné nabídky a zbývající produkty. Při selhání služby rozhraní výslovně uvede, že používá poslední přehled.

Ceny bez DPH, sklad a údaje pro košík se načítají hromadně v aktuální relaci návštěvníka. Nabídky mimo hromadnou odpověď se doplní z detailů právě zobrazených produktů, nejvýše třemi souběžnými požadavky. Aktuální ceny, množství a argumenty košíku zůstávají pouze v paměti stránky. Platnost je pět minut; „Obnovit sklad“ načtení zopakuje. Přepnutí filtrů využije načtené údaje okamžitě. První živé ceny závisejí na rychlosti odpovědi e-shopu; jejich načtení se zobrazuje pomocí stavových zástupných polí.

Cenu, stav skladu a objednání aplikace bere ze stejného dodavatelského bloku; přednost má nabídka označená skladem. Cena pochází přímo z pole bez DPH, není přepočítávaná z hrubé ceny. Text „Skladem“ přebírá nativní označení e-shopu; nemusí znamenat konkrétní pobočku. Přesné dodání a další nabídky jsou na detailu.

Při kliknutí na „Do košíku“ se volá stávající funkce e-shopu `addToBasket`. Argumenty pocházejí z aktuálního detailu a kontroluje se objednací číslo, ID zboží a množství. Nepoužívá se `eval`. Potvrzení vložení a aktualizaci košíku provádí e-shop. Tlačítko samo nevydává předání požadavku za úspěšnou objednávku.

Pokud funkce košíku chybí, změnil se formát stránky, detail nelze načíst nebo je katalog spuštěn mimo doménu Auto Lenc, zůstane k dispozici odkaz na detail. Na samotné GitHub Pages se živé ceny a košík nenačítají. Rozhraní není kopie platebního ani objednávkového procesu.

Napojení je ověřeno proti veřejnému HTML a zdrojovému kódu aktuálního e-shopu a automatickým testem s náhradní funkcí košíku. Skutečné vložení do živého košíku nebylo provedeno. Po vložení bloku ověřte jeden produkt a množství v běžné relaci e-shopu.

## Původ a úplnost parametrů

Základem je celá veřejná větev „Oleje a maziva“, ID 19058. Nejde o soupis všech olejů v celém e-shopu. Konkrétní počty a aktuální pokrytí obsahuje `docs/pokryti.md`.

Parametry jsou převzaté z jednotlivých detailů Auto Lenc. Mají uložený zdroj, datum a původ. Viskozita a objem se mohou převzít z jednoznačného názvu produktu; takový původ je výslovně označen `shop_product_title`. Balení `5 L + 1 L` ani nejasná označení `IBC` se automaticky nepřevádějí na jeden objem. Kompletní původní tabulky jsou zachované.

Chybějící ACEA, API, ILSAC ani schválení se nedoplňují odhadem z názvu nebo podobného výrobku. Schválení výrobce, doporučení a splnění požadavků jsou samostatná pole. `manufacturer_verified: false` znamená, že údaj pochází z katalogu e-shopu a nebyl nezávisle ověřen pro dané objednací číslo u výrobce. Aktuální technický list stejné produktové řady může patřit jiné generaci oleje.

## Ruční doplnění

Upravujte `catalog/oleje/overrides.json`. Klíčem je ID produktu, nikoli jeho objednací číslo. U každého doplnění musí být hodnota, veřejný zdroj a datum. Příklad struktury je v `docs/opravy-priklad.json`; není automaticky načítán. Ručně ověřené opravy mají při načítání přednost před databází.

Pro přejmenování výrobců lze stejným způsobem použít klíč `brand`. Součástí balíčku jsou čtyři opravy výrobce: původně byl místo značky uveden celý název výrobku TOTAL. Původní hodnoty zůstávají v základní databázi. Povolené názvy polí jsou v `config.json`. Soubory JSON musí zůstat platné: dvojité uvozovky, bez komentářů a bez čárky za posledním prvkem.

## Obnova dat

Je potřeba Python 3.10 nebo novější. V kořeni projektu spusťte:

```sh
python -m pip install -r tools/requirements.txt
python tools/refresh_catalog.py --workers 3
python tools/report.py
python tools/check_catalog.py
node tools/tests/cart.test.cjs
node tools/tests/interface.test.cjs
```

Obnova znovu projde celou větev a stáhne detaily. Pro pokračování přerušeného běhu použijte `--work-dir` se stejnou složkou cache, jejíž název obsahuje čas zahájení. Bez uvedení složky se vytvoří nová cache a stáhnou čerstvá data. Živý sklad a cena se do databáze neukládají.

Obnova hlavní databáze automaticky vytvoří také `index.json`. Po ruční úpravě `catalog.json` spusťte `python tools/build_index.py`. Pro obnovu počátečního pořadí skladu použijte `python tools/build_index.py --refresh-stock`; do souboru se uloží jen ID, pořadí a třída dostupnosti, nikoli cena nebo množství. Úpravy v `overrides.json` se aplikují přímo při načtení a nevyžadují obnovu indexu.

Po obnově nahrajte změněnou složku `catalog/oleje` na GitHub. Verze tohoto HTML bloku je `?v=2`; stejnou verzi skript přidává i ke konfiguraci, CSS a pomocnému skriptu, aby se po aktualizaci nenačetla stará kombinace souborů. GitHub sám databázi neobnovuje: poskytuje uložené soubory.
