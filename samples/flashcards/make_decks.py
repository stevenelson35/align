#!/usr/bin/env python3
"""Builds Align's sample flashcard decks (YAML) in this folder. Run:  python3 make_decks.py
Each deck imports into Align with: make a Flashcards list, then "Import a set of cards…" and choose the file."""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent

STATES = [
    ("Alabama", "Montgomery"), ("Alaska", "Juneau"), ("Arizona", "Phoenix"), ("Arkansas", "Little Rock"),
    ("California", "Sacramento"), ("Colorado", "Denver"), ("Connecticut", "Hartford"), ("Delaware", "Dover"),
    ("Florida", "Tallahassee"), ("Georgia", "Atlanta"), ("Hawaii", "Honolulu"), ("Idaho", "Boise"),
    ("Illinois", "Springfield"), ("Indiana", "Indianapolis"), ("Iowa", "Des Moines"), ("Kansas", "Topeka"),
    ("Kentucky", "Frankfort"), ("Louisiana", "Baton Rouge"), ("Maine", "Augusta"), ("Maryland", "Annapolis"),
    ("Massachusetts", "Boston"), ("Michigan", "Lansing"), ("Minnesota", "Saint Paul"), ("Mississippi", "Jackson"),
    ("Missouri", "Jefferson City"), ("Montana", "Helena"), ("Nebraska", "Lincoln"), ("Nevada", "Carson City"),
    ("New Hampshire", "Concord"), ("New Jersey", "Trenton"), ("New Mexico", "Santa Fe"), ("New York", "Albany"),
    ("North Carolina", "Raleigh"), ("North Dakota", "Bismarck"), ("Ohio", "Columbus"), ("Oklahoma", "Oklahoma City"),
    ("Oregon", "Salem"), ("Pennsylvania", "Harrisburg"), ("Rhode Island", "Providence"), ("South Carolina", "Columbia"),
    ("South Dakota", "Pierre"), ("Tennessee", "Nashville"), ("Texas", "Austin"), ("Utah", "Salt Lake City"),
    ("Vermont", "Montpelier"), ("Virginia", "Richmond"), ("Washington", "Olympia"), ("West Virginia", "Charleston"),
    ("Wisconsin", "Madison"), ("Wyoming", "Cheyenne"),
]

# UN member states (193) and their capitals; notes in parentheses where the answer has a common nuance.
COUNTRIES = [
    ("Afghanistan", "Kabul"), ("Albania", "Tirana"), ("Algeria", "Algiers"), ("Andorra", "Andorra la Vella"),
    ("Angola", "Luanda"), ("Antigua and Barbuda", "Saint John's"), ("Argentina", "Buenos Aires"), ("Armenia", "Yerevan"),
    ("Australia", "Canberra"), ("Austria", "Vienna"), ("Azerbaijan", "Baku"), ("Bahamas", "Nassau"),
    ("Bahrain", "Manama"), ("Bangladesh", "Dhaka"), ("Barbados", "Bridgetown"), ("Belarus", "Minsk"),
    ("Belgium", "Brussels"), ("Belize", "Belmopan"), ("Benin", "Porto-Novo (the government sits in Cotonou)"), ("Bhutan", "Thimphu"),
    ("Bolivia", "Sucre (constitutional capital; the government sits in La Paz)"), ("Bosnia and Herzegovina", "Sarajevo"),
    ("Botswana", "Gaborone"), ("Brazil", "Brasília"), ("Brunei", "Bandar Seri Begawan"), ("Bulgaria", "Sofia"),
    ("Burkina Faso", "Ouagadougou"), ("Burundi", "Gitega (since 2019; Bujumbura is the largest city)"), ("Cabo Verde", "Praia"),
    ("Cambodia", "Phnom Penh"), ("Cameroon", "Yaoundé"), ("Canada", "Ottawa"), ("Central African Republic", "Bangui"),
    ("Chad", "N'Djamena"), ("Chile", "Santiago"), ("China", "Beijing"), ("Colombia", "Bogotá"), ("Comoros", "Moroni"),
    ("Congo (Republic of the Congo)", "Brazzaville"), ("Congo (Democratic Republic of the Congo)", "Kinshasa"),
    ("Costa Rica", "San José"), ("Côte d'Ivoire", "Yamoussoukro (official; Abidjan is the largest city)"), ("Croatia", "Zagreb"),
    ("Cuba", "Havana"), ("Cyprus", "Nicosia"), ("Czechia", "Prague"), ("Denmark", "Copenhagen"), ("Djibouti", "Djibouti"),
    ("Dominica", "Roseau"), ("Dominican Republic", "Santo Domingo"), ("Ecuador", "Quito"), ("Egypt", "Cairo"),
    ("El Salvador", "San Salvador"), ("Equatorial Guinea", "Malabo"), ("Eritrea", "Asmara"), ("Estonia", "Tallinn"),
    ("Eswatini", "Mbabane (administrative; Lobamba is the royal and legislative capital)"), ("Ethiopia", "Addis Ababa"),
    ("Fiji", "Suva"), ("Finland", "Helsinki"), ("France", "Paris"), ("Gabon", "Libreville"), ("Gambia", "Banjul"),
    ("Georgia (country)", "Tbilisi"), ("Germany", "Berlin"), ("Ghana", "Accra"), ("Greece", "Athens"),
    ("Grenada", "St. George's"), ("Guatemala", "Guatemala City"), ("Guinea", "Conakry"), ("Guinea-Bissau", "Bissau"),
    ("Guyana", "Georgetown"), ("Haiti", "Port-au-Prince"), ("Honduras", "Tegucigalpa"), ("Hungary", "Budapest"),
    ("Iceland", "Reykjavík"), ("India", "New Delhi"), ("Indonesia", "Jakarta (a new capital, Nusantara, is being built)"),
    ("Iran", "Tehran"), ("Iraq", "Baghdad"), ("Ireland", "Dublin"), ("Israel", "Jerusalem (its status is disputed; many embassies are in Tel Aviv)"),
    ("Italy", "Rome"), ("Jamaica", "Kingston"), ("Japan", "Tokyo"), ("Jordan", "Amman"), ("Kazakhstan", "Astana"),
    ("Kenya", "Nairobi"), ("Kiribati", "South Tarawa"), ("Kuwait", "Kuwait City"), ("Kyrgyzstan", "Bishkek"),
    ("Laos", "Vientiane"), ("Latvia", "Riga"), ("Lebanon", "Beirut"), ("Lesotho", "Maseru"), ("Liberia", "Monrovia"),
    ("Libya", "Tripoli"), ("Liechtenstein", "Vaduz"), ("Lithuania", "Vilnius"), ("Luxembourg", "Luxembourg"),
    ("Madagascar", "Antananarivo"), ("Malawi", "Lilongwe"), ("Malaysia", "Kuala Lumpur (government offices are in Putrajaya)"),
    ("Maldives", "Malé"), ("Mali", "Bamako"), ("Malta", "Valletta"), ("Marshall Islands", "Majuro"),
    ("Mauritania", "Nouakchott"), ("Mauritius", "Port Louis"), ("Mexico", "Mexico City"), ("Micronesia", "Palikir"),
    ("Moldova", "Chișinău"), ("Monaco", "Monaco"), ("Mongolia", "Ulaanbaatar"), ("Montenegro", "Podgorica"),
    ("Morocco", "Rabat"), ("Mozambique", "Maputo"), ("Myanmar", "Naypyidaw"), ("Namibia", "Windhoek"),
    ("Nauru", "Yaren (no official capital; the government is in Yaren District)"), ("Nepal", "Kathmandu"),
    ("Netherlands", "Amsterdam (the government sits in The Hague)"), ("New Zealand", "Wellington"), ("Nicaragua", "Managua"),
    ("Niger", "Niamey"), ("Nigeria", "Abuja"), ("North Korea", "Pyongyang"), ("North Macedonia", "Skopje"),
    ("Norway", "Oslo"), ("Oman", "Muscat"), ("Pakistan", "Islamabad"), ("Palau", "Ngerulmud"), ("Panama", "Panama City"),
    ("Papua New Guinea", "Port Moresby"), ("Paraguay", "Asunción"), ("Peru", "Lima"), ("Philippines", "Manila"),
    ("Poland", "Warsaw"), ("Portugal", "Lisbon"), ("Qatar", "Doha"), ("Romania", "Bucharest"), ("Russia", "Moscow"),
    ("Rwanda", "Kigali"), ("Saint Kitts and Nevis", "Basseterre"), ("Saint Lucia", "Castries"),
    ("Saint Vincent and the Grenadines", "Kingstown"), ("Samoa", "Apia"), ("San Marino", "San Marino"),
    ("São Tomé and Príncipe", "São Tomé"), ("Saudi Arabia", "Riyadh"), ("Senegal", "Dakar"), ("Serbia", "Belgrade"),
    ("Seychelles", "Victoria"), ("Sierra Leone", "Freetown"), ("Singapore", "Singapore"), ("Slovakia", "Bratislava"),
    ("Slovenia", "Ljubljana"), ("Solomon Islands", "Honiara"), ("Somalia", "Mogadishu"),
    ("South Africa", "Pretoria (executive; Cape Town is the legislative and Bloemfontein the judicial capital)"),
    ("South Korea", "Seoul"), ("South Sudan", "Juba"), ("Spain", "Madrid"),
    ("Sri Lanka", "Sri Jayawardenepura Kotte (official; Colombo is the commercial capital)"), ("Sudan", "Khartoum"),
    ("Suriname", "Paramaribo"), ("Sweden", "Stockholm"), ("Switzerland", "Bern"), ("Syria", "Damascus"),
    ("Tajikistan", "Dushanbe"), ("Tanzania", "Dodoma (Dar es Salaam is the largest city)"), ("Thailand", "Bangkok"),
    ("Timor-Leste", "Dili"), ("Togo", "Lomé"), ("Tonga", "Nukuʻalofa"), ("Trinidad and Tobago", "Port of Spain"),
    ("Tunisia", "Tunis"), ("Türkiye (Turkey)", "Ankara"), ("Turkmenistan", "Ashgabat"), ("Tuvalu", "Funafuti"),
    ("Uganda", "Kampala"), ("Ukraine", "Kyiv"), ("United Arab Emirates", "Abu Dhabi"), ("United Kingdom", "London"),
    ("United States", "Washington, D.C."), ("Uruguay", "Montevideo"), ("Uzbekistan", "Tashkent"), ("Vanuatu", "Port Vila"),
    ("Venezuela", "Caracas"), ("Vietnam", "Hanoi"), ("Yemen", "Sanaa (the internationally recognized government has been based in Aden during the civil war)"),
    ("Zambia", "Lusaka"), ("Zimbabwe", "Harare"),
]

# Large U.S. cities (roughly the 100 largest by population in the 2020 Census); notes where the name is shared.
CITIES = [
    ("New York", "New York"), ("Los Angeles", "California"), ("Chicago", "Illinois"), ("Houston", "Texas"),
    ("Phoenix", "Arizona"), ("Philadelphia", "Pennsylvania"), ("San Antonio", "Texas"), ("San Diego", "California"),
    ("Dallas", "Texas"), ("San Jose", "California"), ("Austin", "Texas"), ("Jacksonville", "Florida"),
    ("Fort Worth", "Texas"), ("Columbus", "Ohio (there's also a Columbus in Georgia)"), ("Indianapolis", "Indiana"),
    ("Charlotte", "North Carolina"), ("San Francisco", "California"), ("Seattle", "Washington"), ("Denver", "Colorado"),
    ("Washington", "District of Columbia (not a state; the nation's capital)"), ("Nashville", "Tennessee"),
    ("Oklahoma City", "Oklahoma"), ("El Paso", "Texas"), ("Boston", "Massachusetts"),
    ("Portland", "Oregon (there's also a Portland in Maine)"), ("Las Vegas", "Nevada"), ("Detroit", "Michigan"),
    ("Memphis", "Tennessee"), ("Louisville", "Kentucky"), ("Baltimore", "Maryland"), ("Milwaukee", "Wisconsin"),
    ("Albuquerque", "New Mexico"), ("Tucson", "Arizona"), ("Fresno", "California"), ("Sacramento", "California"),
    ("Kansas City", "Missouri (the bigger one; there's also Kansas City, Kansas)"), ("Mesa", "Arizona"), ("Atlanta", "Georgia"),
    ("Omaha", "Nebraska"), ("Colorado Springs", "Colorado"), ("Raleigh", "North Carolina"), ("Long Beach", "California"),
    ("Virginia Beach", "Virginia"), ("Miami", "Florida"), ("Oakland", "California"), ("Minneapolis", "Minnesota"),
    ("Tulsa", "Oklahoma"), ("Bakersfield", "California"), ("Wichita", "Kansas"), ("Arlington", "Texas (there's also Arlington, Virginia)"),
    ("Aurora", "Colorado (there's also an Aurora in Illinois)"), ("Tampa", "Florida"), ("New Orleans", "Louisiana"),
    ("Cleveland", "Ohio"), ("Honolulu", "Hawaii"), ("Anaheim", "California"), ("Lexington", "Kentucky"),
    ("Stockton", "California"), ("Corpus Christi", "Texas"), ("Henderson", "Nevada"), ("Riverside", "California"),
    ("Newark", "New Jersey"), ("Saint Paul", "Minnesota"), ("Santa Ana", "California"), ("Cincinnati", "Ohio"),
    ("Irvine", "California"), ("Orlando", "Florida"), ("Pittsburgh", "Pennsylvania"), ("St. Louis", "Missouri"),
    ("Greensboro", "North Carolina"), ("Jersey City", "New Jersey"), ("Anchorage", "Alaska"), ("Lincoln", "Nebraska"),
    ("Plano", "Texas"), ("Durham", "North Carolina"), ("Buffalo", "New York"), ("Chandler", "Arizona"),
    ("Chula Vista", "California"), ("Toledo", "Ohio"), ("Madison", "Wisconsin"), ("Gilbert", "Arizona"), ("Reno", "Nevada"),
    ("Fort Wayne", "Indiana"), ("North Las Vegas", "Nevada"), ("St. Petersburg", "Florida"), ("Lubbock", "Texas"),
    ("Irving", "Texas"), ("Laredo", "Texas"), ("Winston-Salem", "North Carolina"), ("Chesapeake", "Virginia"),
    ("Glendale", "Arizona (there's also a Glendale in California)"), ("Garland", "Texas"), ("Scottsdale", "Arizona"),
    ("Norfolk", "Virginia"), ("Boise", "Idaho"), ("Fremont", "California"), ("Spokane", "Washington"),
    ("Santa Clarita", "California"), ("Baton Rouge", "Louisiana"), ("Richmond", "Virginia (there's also a Richmond in California)"),
]


def write(name, title, pairs):
    lines = [
        f"# {title} ({len(pairs)} cards).",
        "# Import in Align: make a Flashcards list, then \"Import a set of cards…\" and choose this file.",
    ]
    for front, back in pairs:
        lines.append(f"- front: {json.dumps(front, ensure_ascii=False)}")
        lines.append(f"  back: {json.dumps(back, ensure_ascii=False)}")
    (OUT / name).write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(name, len(pairs))


assert len(STATES) == 50 and len({s for s, _ in STATES}) == 50
assert len(COUNTRIES) == 193 and len({c for c, _ in COUNTRIES}) == 193
assert len({c for c, _ in CITIES}) == len(CITIES)
write("state-capital-to-state.yaml", "State capital → state", [(c, s) for s, c in STATES])
write("state-to-state-capital.yaml", "State → state capital", STATES)
write("country-to-capital.yaml", "Country → capital (the 193 UN member states)", COUNTRIES)
write("large-city-to-state.yaml", "Large U.S. city → state (about the 100 largest)", CITIES)

# ---- Country -> continent (seven-continent model; Caribbean and Central America count as North America) ----
CONT = {
    "Africa": ["Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cabo Verde", "Cameroon", "Central African Republic", "Chad",
               "Comoros", "Congo (Republic of the Congo)", "Congo (Democratic Republic of the Congo)", "Côte d'Ivoire", "Djibouti", "Egypt",
               "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea", "Guinea-Bissau", "Kenya", "Lesotho",
               "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria",
               "Rwanda", "São Tomé and Príncipe", "Senegal", "Seychelles", "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan",
               "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe"],
    "Europe": ["Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Czechia", "Denmark",
               "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Latvia", "Liechtenstein", "Lithuania",
               "Luxembourg", "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "North Macedonia", "Norway", "Poland", "Portugal", "Romania",
               "Russia", "San Marino", "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Ukraine", "United Kingdom"],
    "Asia": ["Afghanistan", "Armenia", "Azerbaijan", "Bahrain", "Bangladesh", "Bhutan", "Brunei", "Cambodia", "China", "Cyprus", "Georgia (country)",
             "India", "Indonesia", "Iran", "Iraq", "Israel", "Japan", "Jordan", "Kazakhstan", "Kuwait", "Kyrgyzstan", "Laos", "Lebanon", "Malaysia",
             "Maldives", "Mongolia", "Myanmar", "Nepal", "North Korea", "Oman", "Pakistan", "Philippines", "Qatar", "Saudi Arabia", "Singapore",
             "South Korea", "Sri Lanka", "Syria", "Tajikistan", "Thailand", "Timor-Leste", "Türkiye (Turkey)", "Turkmenistan", "United Arab Emirates",
             "Uzbekistan", "Vietnam", "Yemen"],
    "North America": ["Antigua and Barbuda", "Bahamas", "Barbados", "Belize", "Canada", "Costa Rica", "Cuba", "Dominica", "Dominican Republic",
                      "El Salvador", "Grenada", "Guatemala", "Haiti", "Honduras", "Jamaica", "Mexico", "Nicaragua", "Panama", "Saint Kitts and Nevis",
                      "Saint Lucia", "Saint Vincent and the Grenadines", "Trinidad and Tobago", "United States"],
    "South America": ["Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Ecuador", "Guyana", "Paraguay", "Peru", "Suriname", "Uruguay", "Venezuela"],
    "Oceania (Australia and the Pacific)": ["Australia", "Fiji", "Kiribati", "Marshall Islands", "Micronesia", "Nauru", "New Zealand", "Palau",
                                            "Papua New Guinea", "Samoa", "Solomon Islands", "Tonga", "Tuvalu", "Vanuatu"],
}
CENTRAL = {"Belize", "Costa Rica", "El Salvador", "Guatemala", "Honduras", "Nicaragua", "Panama"}
CARIBBEAN = {"Antigua and Barbuda", "Bahamas", "Barbados", "Cuba", "Dominica", "Dominican Republic", "Grenada", "Haiti", "Jamaica",
             "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Trinidad and Tobago"}
NOTES = {
    "Russia": "Europe and Asia (most of its land is in Asia; most people live in the European part)",
    "Türkiye (Turkey)": "Asia and Europe (mostly Asia; Istanbul straddles both)",
    "Kazakhstan": "Asia (a small western part is in Europe)",
    "Egypt": "Africa (the Sinai Peninsula is in Asia)",
    "Georgia (country)": "Asia (on the Europe–Asia border; often counted as Europe)",
    "Armenia": "Asia (often counted as Europe)",
    "Azerbaijan": "Asia (a small part is in Europe; often counted as Europe)",
    "Cyprus": "Asia (geographically; it's a member of the European Union)",
    "Indonesia": "Asia (its part of New Guinea is in Oceania)",
    "Trinidad and Tobago": "North America (Caribbean; just off South America)",
}
continent_of = {}
for cont, names in CONT.items():
    for n in names:
        assert n not in continent_of, n
        continent_of[n] = cont
missing = [c for c, _ in COUNTRIES if c not in continent_of]
extra = [n for n in continent_of if n not in {c for c, _ in COUNTRIES}]
assert not missing and not extra, (missing, extra)
def cont_back(c):
    if c in NOTES: return NOTES[c]
    base = continent_of[c]
    if c in CENTRAL: return f"{base} (Central America)"
    if c in CARIBBEAN: return f"{base} (Caribbean)"
    return base
write("country-to-continent.yaml", "Country → continent (the 193 UN member states)", [(c, cont_back(c)) for c, _ in COUNTRIES])

# ---- Large world city -> country (about 100 of the world's biggest and best-known cities) ----
WORLD = [
    ("Tokyo", "Japan"), ("Delhi", "India"), ("Shanghai", "China"), ("São Paulo", "Brazil"), ("Mexico City", "Mexico"),
    ("Cairo", "Egypt"), ("Mumbai", "India"), ("Beijing", "China"), ("Dhaka", "Bangladesh"), ("Osaka", "Japan"),
    ("New York City", "United States"), ("Karachi", "Pakistan"), ("Buenos Aires", "Argentina"), ("Chongqing", "China"),
    ("Istanbul", "Türkiye (Turkey)"), ("Kolkata", "India"), ("Manila", "Philippines"), ("Lagos", "Nigeria"),
    ("Rio de Janeiro", "Brazil"), ("Tianjin", "China"), ("Kinshasa", "Democratic Republic of the Congo"), ("Guangzhou", "China"),
    ("Los Angeles", "United States"), ("Moscow", "Russia"), ("Shenzhen", "China"), ("Lahore", "Pakistan"), ("Bengaluru (Bangalore)", "India"),
    ("Paris", "France"), ("Bogotá", "Colombia"), ("Jakarta", "Indonesia"), ("Chennai", "India"), ("Lima", "Peru"), ("Bangkok", "Thailand"),
    ("Seoul", "South Korea"), ("Nagoya", "Japan"), ("Hyderabad", "India"), ("London", "United Kingdom"), ("Tehran", "Iran"),
    ("Chicago", "United States"), ("Chengdu", "China"), ("Nanjing", "China"), ("Wuhan", "China"), ("Ho Chi Minh City", "Vietnam"),
    ("Luanda", "Angola"), ("Ahmedabad", "India"), ("Kuala Lumpur", "Malaysia"), ("Xi'an", "China"),
    ("Hong Kong", "China (Hong Kong Special Administrative Region)"), ("Hangzhou", "China"), ("Riyadh", "Saudi Arabia"),
    ("Baghdad", "Iraq"), ("Santiago", "Chile"), ("Surat", "India"), ("Madrid", "Spain"), ("Pune", "India"), ("Harbin", "China"),
    ("Houston", "United States"), ("Dallas", "United States"), ("Toronto", "Canada"), ("Dar es Salaam", "Tanzania"),
    ("Miami", "United States"), ("Belo Horizonte", "Brazil"), ("Singapore", "Singapore"), ("Philadelphia", "United States"),
    ("Atlanta", "United States"), ("Fukuoka", "Japan"), ("Khartoum", "Sudan"), ("Barcelona", "Spain"), ("Johannesburg", "South Africa"),
    ("Saint Petersburg", "Russia (there's also a St. Petersburg in Florida)"), ("Qingdao", "China"), ("Washington, D.C.", "United States"),
    ("Yangon", "Myanmar"), ("Alexandria", "Egypt (there's also an Alexandria in Virginia)"), ("Guadalajara", "Mexico"),
    ("Abidjan", "Côte d'Ivoire"), ("Ankara", "Türkiye (Turkey)"), ("Chittagong", "Bangladesh"), ("Melbourne", "Australia"),
    ("Sydney", "Australia"), ("Monterrey", "Mexico"), ("Nairobi", "Kenya"), ("Hanoi", "Vietnam"), ("Berlin", "Germany"),
    ("Rome", "Italy"), ("Montreal", "Canada"), ("Cape Town", "South Africa"), ("Casablanca", "Morocco"), ("Addis Ababa", "Ethiopia"),
    ("Kabul", "Afghanistan"), ("Jeddah", "Saudi Arabia"), ("Busan", "South Korea"), ("Taipei", "Taiwan"),
    ("Dubai", "United Arab Emirates"), ("Athens", "Greece"), ("Vienna", "Austria"), ("Kyiv", "Ukraine"), ("Warsaw", "Poland"),
    ("Amsterdam", "Netherlands"), ("Accra", "Ghana"), ("Havana", "Cuba"), ("Caracas", "Venezuela"), ("Medellín", "Colombia"),
    ("Quito", "Ecuador"), ("Vancouver", "Canada"), ("Munich", "Germany"), ("Milan", "Italy"), ("Lisbon", "Portugal"),
]
assert len({c for c, _ in WORLD}) == len(WORLD)
write("large-city-to-country.yaml", "Large world city → country (about 100 of the biggest and best-known)", WORLD)

# ---- Texas Hold'em: outs and odds, pot odds, terms, and short "how to assess" scenarios ----
from math import comb


def pct(x):
    return f"{x * 100:.1f}%"


def by_river(outs):  # after the flop: 47 unseen cards, two to come
    return 1 - comb(47 - outs, 2) / comb(47, 2)


def next_card(outs):  # one card to come: 46 unseen
    return outs / 46


POKER = []
DRAWS = {2: "pocket pair to a set", 4: "gutshot straight", 6: "two overcards", 8: "open-ended straight", 9: "flush",
         12: "flush draw + gutshot", 15: "flush draw + open-ended straight"}
for outs in [2, 4, 6, 8, 9, 12, 15]:
    POKER.append((f"{outs} outs after the flop ({DRAWS[outs]}): chance to hit by the river?",
                  f"{pct(by_river(outs))} by the river; {pct(next_card(outs))} with one card to come. (Rule of 2 and 4: about {outs * 4}% / {outs * 2}%.)"))
for pot, call in [(30, 10), (100, 50), (60, 20), (90, 30), (40, 40), (150, 25)]:
    need = call / (pot + call)
    POKER.append((f"Pot is ${pot}, you must call ${call}. What equity do you need (pot odds)?",
                  f"{pct(need)}: you risk ${call} to win ${pot + call} in total ({call} ÷ {pot + call}). Odds of {pot}:{call} = {pot / call:.1f} to 1."))
POKER += [
    ("Pocket aces: how often are they dealt?", "1 in 221 hands (0.45%)."),
    ("Any pocket pair: how often?", "About 1 in 17 hands (5.9%)."),
    ("Pocket pair: chance of flopping a set or better?", "About 11.8% (1 in 8.5)."),
    ("AA vs KK all in preflop: equity?", "AA about 82%, KK about 18%."),
    ("A pair vs two higher cards (QQ vs AK) preflop?", "Close to a coin flip; the pair is a small favorite (about 55–57%)."),
    ("AK vs AQ preflop?", "AK wins roughly 3 times in 4 (about 70–75%)."),
    ("Position: what is the button, and why is it good?", "The dealer seat. It acts last after the flop, so it sees everyone else’s actions first."),
    ("Under the gun (UTG)?", "The first player to act before the flop (left of the big blind). Play tighter there: everyone else acts after you."),
    ("Small blind and big blind?", "Forced bets posted by the two players left of the button before cards are dealt; the big blind is usually twice the small blind."),
    ("Implied odds?", "Extra money you expect to win on later streets if you hit. They can justify a call when pot odds alone are a little short."),
    ("Expected value (EV) of a call?", "Equity × (pot after your call) − the call. Positive means the call wins money in the long run."),
    ("Semi-bluff?", "Betting or raising with a draw: you can win now if they fold, or later if you hit."),
    ("Tight vs loose, passive vs aggressive?", "Tight/loose is how many hands you play; passive/aggressive is whether you mostly call or mostly bet and raise. Tight-aggressive is a solid default."),
    ("You hold J♥T♥; the flop is 9♥ 8♣ 2♥. How many outs, and your chance by the river?",
     f"15 outs: 9 hearts for a flush plus 6 non-heart queens or sevens for a straight. About {pct(by_river(15))} by the river—you’re a favorite against one pair."),
    ("You hold 7♣7♦; the flop is K♠ 9♥ 4♦ and an opponent bets. What are you drawing to?",
     f"Only 2 outs to a set ({pct(by_river(2))} by the river, {pct(next_card(2))} next card). Without very good implied odds this is usually a fold."),
    ("You hold A♠K♦; the flop is Q♣ J♥ 3♠. Outs?",
     f"4 tens for a straight (gutshot) plus 6 aces/kings for top pair: about 10 outs, roughly {pct(by_river(10))} by the river, though top pair may not be enough."),
    ("Flush draw, one card to come. Pot $100, opponent bets $50. Call on pot odds alone?",
     f"No: you need 25% (50 ÷ 200) and have about {pct(next_card(9))} (9 ÷ 46). Calling needs implied odds—money you’ll win if you hit."),
    ("Open-ended straight draw after the flop. Pot $60, opponent bets $20. Call?",
     f"Yes on pot odds: you need 20 ÷ 80 = 25% and have about {pct(next_card(8))} for the next card alone, {pct(by_river(8))} by the river if you’ll see both cards cheaply—close, and implied odds help."),
    ("How to assess a decision: what should you weigh?",
     "Your hand and outs (equity), the pot odds of the call, position (do you act last?), the number of players still in, stack sizes (implied odds), and what the opponent’s bets suggest they hold."),
    ("More players in the hand: how does it change things?",
     "More opponents means someone is more likely to have a strong hand, so medium hands (one pair) lose value and big draws gain value (bigger pots when you hit)."),
]
write("texas-holdem-odds.yaml", "Texas Hold'em: odds, outs, pot odds, positions and scenarios", POKER)
