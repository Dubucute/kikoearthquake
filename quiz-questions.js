// ─── TAGALOG QUIZ QUESTIONS ──────────────────────────────────
const QUIZ_TL = [
  {
    question: 'Ano ang unang dapat gawin kapag lumilindol at nasa loob ka ng bahay?',
    choices: ['Tumakbo agad palabas', 'Gawin ang Drop, Cover, at Hold On', 'Tawagan ang pamilya', 'Tumalon sa bintana'],
    answer: 1
  },
  {
    question: 'Saan ang pinakaligtas na pwesto sa loob ng bahay kapag may lindol?',
    choices: ['Sa ilalim ng matibay na mesa', 'Sa tabi ng bintana', 'Sa loob ng elevator', 'Sa balkonahe'],
    answer: 0
  },
  {
    question: 'Ano ang dapat mong gawin kung nasa labas ka habang lumilindol?',
    choices: ['Magtago sa tabi ng mga gusali', 'Iligtas ang mga gamit', 'Lumayo sa mga puno, pader, at poste', 'Umakyat sa bubong'],
    answer: 2
  },
  {
    question: 'Alin ang HINDI ligtas gawin kapag may lindol?',
    choices: ['Magtago sa ilalim ng mesa', 'Humawak o sumandal sa pinto', 'Lumayo sa mga appliances', 'Lumayo sa mga salamin'],
    answer: 1
  },
  {
    question: 'Ano ang pinakamahalagang dapat laging handa para sa lindol?',
    choices: ['Emergency kit o Go Bag', 'Magagandang damit', 'Sobrang stock ng pagkain', 'Mga alahas'],
    answer: 0
  },
  {
    question: 'Kung nasa kusina ka at biglang lumindol, ano ang unang dapat gawin?',
    choices: ['Buksan ang oven', 'Lumayo sa mga matutulis na gamit', 'Tumakbo agad palabas', 'Patayin ang kalan kung kaya'],
    answer: 3
  },
  {
    question: 'Bakit bawal gumamit ng elevator kapag may lindol?',
    choices: ['Dahil mas mabilis ito', 'Maaaring mawalan ng kuryente at ma-trap', 'Dahil malamig sa loob', 'Mas malayo sa labasan'],
    answer: 1
  },
  {
    question: 'Ano ang ibig sabihin ng "aftershock"?',
    choices: ['Mga kasunod na mahihinang lindol', 'Darating na bagyo', 'Malakas na ulan', 'Pagsabog ng bulkan'],
    answer: 0
  },
  {
    question: 'Ano ang dapat gawin kung nasa loob ng kotse habang lumilindol?',
    choices: ['Itabi nang ligtas ang kotse at manatili sa loob', 'Tumakbo palabas agad', 'Huminto sa ilalim ng tulay', 'Magmaneho nang mas mabilis'],
    answer: 0
  },
  {
    question: 'Anong item ang pinaka-importante sa emergency kit kapag brownout?',
    choices: ['Flashlight o emergency light', 'Maraming damit', 'Bulaklak', 'Mga laruan'],
    answer: 0
  },
  {
    question: 'Kung nasa beach ka at lumindol, ano ang dapat mong gawin?',
    choices: ['Lumikas sa mataas na lugar dahil sa tsunami', 'Manatili lang sa tabing-dagat', 'Lumangoy palayo sa pampang', 'Sumakay sa bangka'],
    answer: 0
  },
  {
    question: 'Ano ang pinakamagandang gawin kung nasa higaan ka habang may lindol?',
    choices: ['Manatili sa kama at takpan ang ulo ng unan', 'Tumakbo agad palabas nang nakapaa', 'Tumalon sa bintana', 'Tumakbo sa kusina'],
    answer: 0
  },
  {
    question: 'Ano ang dapat mong gawin kung nasa paaralan ka kapag lumindol?',
    choices: ['Magtago sa ilalim ng desk o mesa', 'Tumakbo palabas kahit walang sinasabi ang guro', 'Tumalon sa bintana', 'Maglaro sa hallway'],
    answer: 0
  },
  {
    question: 'Alin ang delikadong gamitin o sindihan habang at pagkatapos ng lindol?',
    choices: ['Matibay na mesa', 'Kandila, posporo, o bukas na apoy', 'Sapatos o tsinelas', 'Sasakyan'],
    answer: 1
  },
  {
    question: 'Bakit kailangan ng flashlight sa emergency kit?',
    choices: ['Para makakita at makahingi ng tulong sa dilim', 'Para may laruan habang naghihintay', 'Para mag-signal sa sasakyan', 'Para pang-selfie'],
    answer: 0
  },
  {
    question: 'Kung may gas leak pagkatapos ng lindol, ano ang dapat gawin?',
    choices: ['Isara ang gas at buksan ang mga bintana', 'Iwanang bukas ang gas tank', 'Sindihan ang apoy para i-check', 'Sumigaw lang ng tulong'],
    answer: 0
  },
  {
    question: 'Ano ang tamang gawin kapag lumindol habang nasa loob ka ng mall?',
    choices: ['Lumayo sa mga salamin at malalaking ilaw', 'Mag-abang sa elevator', 'Sumakay sa escalator', 'Manatili sa gitna ng store'],
    answer: 0
  },
  {
    question: 'Alin ang HINDI kasama sa isang basic emergency kit?',
    choices: ['First aid kit', 'Extra batteries at powerbank', 'Tubig', 'Larawan ng celebrity'],
    answer: 3
  },
  {
    question: 'Ano ang dapat gawin kung may malakas na lindol habang nakasakay sa bus?',
    choices: ['Manatiling nakaupo at humawak nang mahigpit', 'Tumalon agad palabas', 'Tumayo at pumunta sa driver', 'Maglakad-lakad sa gitna ng aisle'],
    answer: 0
  },
  {
    question: 'Bakit mahalaga ang family emergency plan?',
    choices: ['Para alam kung saan magkikita at paano mag-uusap', 'Para mag-away ang pamilya', 'Para may mai-post sa social media', 'Para sa party'],
    answer: 0
  },
  {
    question: 'Kapag nasa ilalim ng mesa, ano ang dapat gawin sa iyong mga kamay?',
    choices: ['Ihawak nang mahigpit sa paa ng mesa', 'Itaas sa ere', 'Ilagay sa bulsa', 'Gamitin pang-hilot sa ulo'],
    answer: 0
  },
  {
    question: 'Kung may mga basag na bintana sa bahay dahil sa lindol, saan dapat pumunta?',
    choices: ['Sa gitna ng kwarto, malayo sa salamin', 'Tumayo sa tabi ng bintana', 'Sa tabi ng matataas na aparador', 'Sa ilalim ng bombilya'],
    answer: 0
  },
  {
    question: 'Ano ang dapat iwasan kapag huminto na ang pagyanig ng lindol?',
    choices: ['Ang biglaang pagbalik sa loob ng sirang bahay', 'Ang paghahanap sa pamilya', 'Ang paggamit ng flashlight', 'Ang pagtulong sa iba'],
    answer: 0
  },
  {
    question: 'Ano ang ibig sabihin ng "DROP, COVER, HOLD ON"?',
    choices: ['Dapa, tago sa ilalim ng mesa, at hawak nang mahigpit', 'Tumakbo, sumigaw, at humawak sa pader', 'Tumalon, tumakbo, at humingi ng tulong', 'Tumayo, umakyat, at maghintay'],
    answer: 0
  },
  {
    question: 'Ano ang gagawin mo kung nakaramdam ng lindol habang nagluluto?',
    choices: ['Patayin agad ang kalan at lumayo sa kusina', 'Ipagpatuloy lang ang pagluluto', 'Tumakbo palabas dala ang kawali', 'Maglakad-lakad sa paligid ng kusina'],
    answer: 0
  },
  {
    question: 'Ano ang pinakaligtas na paraan para makausap ang pamilya pagkatapos ng lindol?',
    choices: ['Mag-text o mag-chat dahil madalas may network congestion', 'Tumawag nang matagal', 'Mag-live sa social media', 'Huwag nang mag-paramdam'],
    answer: 0
  },
  {
    question: 'Kung na-trap ka sa ilalim ng gumuhong pader, ano ang pinakamagandang gawin?',
    choices: ['Sumigaw nang walang tigil', 'Kumatok o pumalo sa pader/tubo para marinig ng rescuers', 'Matulog na lang', 'Subukang buhatin ang pader mag-isa'],
    answer: 1
  },
  {
    question: 'Ano ang dapat gawin sa mga mabibigat na appliances o estante sa bahay bago pa magkalindol?',
    choices: ['I-anchor o itali nang matibay sa pader', 'Ipatong sa ibabaw ng refrigerator', 'Hayaan lang sa gitna ng daanan', 'Ilagay sa harap ng pinto'],
    answer: 0
  },
  {
    question: 'Sino ang pangunahing ahensya ng gobyerno sa Pilipinas na nagbabantay sa mga lindol at bulkan?',
    choices: ['PAGASA', 'PHIVOLCS', 'DENR', 'DepEd'],
    answer: 1
  },
  {
    question: 'Gaano karaming tubig ang ideal na i-imbak bawat tao kada araw sa isang emergency kit?',
    choices: ['Isang baso lang', 'Isang galon (mga 4 liters)', 'Isang sachet', 'Kahit wala, may softdrinks naman'],
    answer: 1
  },
  {
    question: 'Anong uri ng pagkain ang pinaka-angkop ilagay sa iyong Go Bag?',
    choices: ['Mga pagkaing madaling mapanis tulad ng kanin at ulam', 'Mga frozen food', 'Ready-to-eat o canned goods na hindi kailangan lutuin', 'Mga hilaw na karne'],
    answer: 2
  },
  {
    question: 'Kung may kasama kang matanda o may kapansanan sa bahay, kailan mo dapat planuhin ang paglikas nila?',
    choices: ['Ngayon pa lang, bago pa man magkalindol', 'Kapag gumuguho na ang bahay', 'Pagkatapos ng isang linggo', 'Iwan na lang sa mga kapitbahay'],
    answer: 0
  },
  {
    question: 'Ano ang dapat mong gawin kung makakita ka ng sugatan pagkatapos ng lindol at alam mong ligtas ang pwesto ninyo?',
    choices: ['I-video at i-post sa TikTok', 'Iwanan at tumakbo palabas', 'Magpatulong at mag-apply ng basic First Aid kung marunong', 'Hilahin siya nang mabilis kahit may bali sa leeg'],
    answer: 2
  },
  {
    question: 'Ano ang tawag sa sabay-sabay na earthquake drill na ginagawa sa buong bansa?',
    choices: ['NSED (National Simultaneous Earthquake Drill)', 'Fun Run', 'Grand Fiesta', 'Barangay Assembly'],
    answer: 0
  },
  {
    question: 'Kung nasa loob ka ng sinehan o auditorium nang lumindol, ano ang gagawin mo?',
    choices: ['Mag-unahan sa exit para makalabas agad', 'Magtago sa ilalim o sa pagitan ng mga upuan at protektahan ang ulo', 'Umakyat sa ibabaw ng entablado', 'Sumigaw para mag-panic ang lahat'],
    answer: 1
  },
  {
    question: 'Bakit mahalagang i-off ang main switch ng kuryente (circuit breaker) bago lumikas pagkatapos ng lindol?',
    choices: ['Para makatipid sa bill', 'Para maiwasan ang sunog mula sa mga sirang wire', 'Para hindi masira ang TV', 'Para maging madilim ang bahay'],
    answer: 1
  },
  {
    question: 'Gaano kadalas dapat i-check at palitan ang mga laman ng iyong emergency Go Bag?',
    choices: ['Tuwing may lindol lang', 'Kahit isang beses lang sa sampung taon', 'Kada 6 na buwan hanggang isang taon para ma-check ang expiration', 'Araw-araw bago pumasok'],
    answer: 2
  },
  {
    question: 'Anong uri ng sapatos o tsinelas ang pinakamagandang isuot kapag lilikas pagkatapos ng lindol?',
    choices: ['Slippers o high heels', 'Makapal at saradong sapatos para iwas sa bubog o pako', 'Kahit ano, kahit hindi komportable', 'Huwag na mag-sapatos, maglakad nang nakapaa'],
    answer: 1
  },
  {
    question: 'Kung nakatira ka malapit sa paanan ng bundok, anong panganib ang dapat bantayan pagkatapos ng malakas na lindol?',
    choices: ['Tsunami', 'Landslide o pagguho ng lupa', 'Baha', 'Pagsabog ng bulkan'],
    answer: 1
  },
  {
    question: 'Ano ang pangunahing layunin ng pag-duck, cover, at hold kapag lumilindol?',
    choices: ['Para hindi ka makita ng ibang tao', 'Para maprotektahan ang sarili sa mga bumabagsak na bagay', 'Para makapagpahinga habang lumilindol', 'Para makapag-ehersisyo'],
    answer: 1
  }
];

// ─── ENGLISH QUIZ QUESTIONS ───────────────────────────────────
const QUIZ_EN = [
  {
    question: 'What is the first thing to do when an earthquake starts while you are indoors?',
    choices: ['Run outside immediately', 'Drop, Cover, and Hold On', 'Call your family', 'Jump out of the window'],
    answer: 1
  },
  {
    question: 'What is the safest place inside your home during an earthquake?',
    choices: ['Under a sturdy table', 'Next to a window', 'Inside an elevator', 'On a balcony'],
    answer: 0
  },
  {
    question: 'What should you do if you are outside during an earthquake?',
    choices: ['Hide next to buildings', 'Rescue your belongings', 'Stay away from trees, walls, and poles', 'Climb onto the roof'],
    answer: 2
  },
  {
    question: 'Which is NOT safe to do during an earthquake?',
    choices: ['Hide under a table', 'Hold or lean against a door', 'Stay away from appliances', 'Stay away from mirrors'],
    answer: 1
  },
  {
    question: 'What is the most important thing to always have ready for an earthquake?',
    choices: ['Emergency kit or Go Bag', 'Fancy clothes', 'Extra food stock', 'Jewelry'],
    answer: 0
  },
  {
    question: 'If you are in the kitchen when an earthquake hits, what should you do first?',
    choices: ['Turn on the oven', 'Move away from sharp objects', 'Run outside immediately', 'Turn off the stove if you can'],
    answer: 3
  },
  {
    question: 'Why should you not use an elevator during an earthquake?',
    choices: ['Because it is faster', 'Power may fail and you could be trapped', 'Because it is cold inside', 'It is farther from exits'],
    answer: 1
  },
  {
    question: 'What does "aftershock" mean?',
    choices: ['Smaller earthquakes that follow the main quake', 'An incoming storm', 'Heavy rain', 'A volcanic eruption'],
    answer: 0
  },
  {
    question: 'What should you do if you are in your car during an earthquake?',
    choices: ['Pull over to a safe spot and stay inside', 'Run out immediately', 'Stop under a bridge', 'Drive faster'],
    answer: 0
  },
  {
    question: 'Which item is most important in an emergency kit during a blackout?',
    choices: ['Flashlight or emergency light', 'Lots of clothes', 'Flowers', 'Toys'],
    answer: 0
  },
  {
    question: 'If you are at the beach and an earthquake hits, what should you do?',
    choices: ['Evacuate to higher ground due to tsunami risk', 'Stay on the shore', 'Swim away from the coast', 'Get on a boat'],
    answer: 0
  },
  {
    question: 'What should you do if you are in bed during an earthquake?',
    choices: ['Stay in bed and cover your head with a pillow', 'Run outside barefoot', 'Jump out the window', 'Run to the kitchen'],
    answer: 0
  },
  {
    question: 'What should you do if you are at school during an earthquake?',
    choices: ['Hide under a desk or table', 'Run outside even if the teacher says nothing', 'Jump out the window', 'Play in the hallway'],
    answer: 0
  },
  {
    question: 'What is dangerous to use or light during and after an earthquake?',
    choices: ['A sturdy table', 'Candles, matches, or open flames', 'Shoes or slippers', 'A vehicle'],
    answer: 1
  },
  {
    question: 'Why is a flashlight needed in an emergency kit?',
    choices: ['To see and signal for help in the dark', 'To have a toy while waiting', 'To signal to vehicles', 'For selfies'],
    answer: 0
  },
  {
    question: 'If there is a gas leak after an earthquake, what should you do?',
    choices: ['Turn off the gas and open windows', 'Leave the gas tank open', 'Light a fire to check', 'Just shout for help'],
    answer: 0
  },
  {
    question: 'What should you do if an earthquake hits while you are inside a mall?',
    choices: ['Stay away from mirrors and large lights', 'Wait by the elevator', 'Ride the escalator', 'Stay in the middle of the store'],
    answer: 0
  },
  {
    question: 'Which is NOT included in a basic emergency kit?',
    choices: ['First aid kit', 'Extra batteries and power bank', 'Water', 'A celebrity photo'],
    answer: 3
  },
  {
    question: 'What should you do if a strong earthquake hits while riding a bus?',
    choices: ['Stay seated and hold on tightly', 'Jump out immediately', 'Stand up and go to the driver', 'Walk around the aisle'],
    answer: 0
  },
  {
    question: 'Why is a family emergency plan important?',
    choices: ['So you know where to meet and how to communicate', 'So the family can argue', 'To post on social media', 'For a party'],
    answer: 0
  },
  {
    question: 'When under a table, what should you do with your hands?',
    choices: ['Hold onto the table legs tightly', 'Raise them in the air', 'Put them in your pockets', 'Use them to massage your head'],
    answer: 0
  },
  {
    question: 'If there are broken windows at home after an earthquake, where should you go?',
    choices: ['To the middle of the room, away from glass', 'Stand next to the window', 'Near tall cabinets', 'Under a light bulb'],
    answer: 0
  },
  {
    question: 'What should you avoid once the shaking stops?',
    choices: ['Suddenly re-entering a damaged building', 'Looking for your family', 'Using a flashlight', 'Helping others'],
    answer: 0
  },
  {
    question: 'What does "DROP, COVER, HOLD ON" mean?',
    choices: ['Drop down, get under cover, and hold on tight', 'Run, shout, and hold the wall', 'Jump, run, and ask for help', 'Stand, climb, and wait'],
    answer: 0
  },
  {
    question: 'What should you do if you feel an earthquake while cooking?',
    choices: ['Turn off the stove immediately and move away from the kitchen', 'Keep cooking', 'Run outside carrying a pan', 'Walk around the kitchen'],
    answer: 0
  },
  {
    question: 'What is the safest way to contact family after an earthquake?',
    choices: ['Text or chat since calls may have network congestion', 'Long phone calls', 'Go live on social media', 'Do not check in at all'],
    answer: 0
  },
  {
    question: 'If you are trapped under collapsed debris, what is the best action?',
    choices: ['Shout non-stop', 'Tap or knock on a wall or pipe so rescuers can find you', 'Just sleep', 'Try to lift the debris alone'],
    answer: 1
  },
  {
    question: 'What should you do with heavy appliances or shelves before an earthquake?',
    choices: ['Anchor or secure them to the wall', 'Place them on top of the fridge', 'Leave them in the middle of the walkway', 'Place them in front of the door'],
    answer: 0
  },
  {
    question: 'Which government agency in the Philippines monitors earthquakes and volcanoes?',
    choices: ['PAGASA', 'PHIVOLCS', 'DENR', 'DepEd'],
    answer: 1
  },
  {
    question: 'How much water should you ideally store per person per day in an emergency kit?',
    choices: ['One glass', 'One gallon (about 4 liters)', 'One sachet', 'None, soft drinks will do'],
    answer: 1
  },
  {
    question: 'What kind of food is best to put in your Go Bag?',
    choices: ['Perishable food like rice and dishes', 'Frozen food', 'Ready-to-eat or canned goods that need no cooking', 'Raw meat'],
    answer: 2
  },
  {
    question: 'If you live with an elderly or disabled person, when should you plan their evacuation?',
    choices: ['Right now, before an earthquake happens', 'When the house is collapsing', 'After a week', 'Leave it to the neighbors'],
    answer: 0
  },
  {
    question: 'What should you do if you see someone injured after an earthquake and you are in a safe spot?',
    choices: ['Film it and post on TikTok', 'Leave them and run outside', 'Get help and apply basic first aid if you know how', 'Drag them quickly even if they might have a neck injury'],
    answer: 2
  },
  {
    question: 'What is the nationwide simultaneous earthquake drill called in the Philippines?',
    choices: ['NSED (National Simultaneous Earthquake Drill)', 'Fun Run', 'Grand Fiesta', 'Barangay Assembly'],
    answer: 0
  },
  {
    question: 'If you are inside a cinema or auditorium during an earthquake, what should you do?',
    choices: ['Rush to the exit to get out quickly', 'Hide under or between seats and protect your head', 'Climb onto the stage', 'Scream to panic everyone'],
    answer: 1
  },
  {
    question: 'Why is it important to turn off the main circuit breaker before evacuating after an earthquake?',
    choices: ['To save on electricity bills', 'To prevent fires from damaged wires', 'So the TV does not break', 'To make the house dark'],
    answer: 1
  },
  {
    question: 'How often should you check and replace items in your emergency Go Bag?',
    choices: ['Only when there is an earthquake', 'Just once every ten years', 'Every 6 months to 1 year to check expiration dates', 'Every day before going out'],
    answer: 2
  },
  {
    question: 'What type of footwear is best when evacuating after an earthquake?',
    choices: ['Slippers or high heels', 'Thick, closed shoes to avoid broken glass or nails', 'Anything, even if uncomfortable', 'No shoes, walk barefoot'],
    answer: 1
  },
  {
    question: 'If you live near a mountain foot, what risk should you watch for after a strong earthquake?',
    choices: ['Tsunami', 'Landslide', 'Flood', 'Volcanic eruption'],
    answer: 1
  },
  {
    question: 'What is the main purpose of duck, cover, and hold during an earthquake?',
    choices: ['So other people cannot see you', 'To protect yourself from falling objects', 'To rest while the ground shakes', 'To exercise'],
    answer: 1
  }
];

// ─── CEBUANO QUIZ QUESTIONS ───────────────────────────────────
const QUIZ_CEB = [
  {
    question: 'Unsa ang una nimong buhaton kung maglinog samtang naa ka sa sulod sa balay?',
    choices: ['Dagan dayon pagawas', 'Buhata ang Drop, Cover, ug Hold On', 'Tawag sa pamilya', 'Lukso sa bintana'],
    answer: 1
  },
  {
    question: 'Asa ang pinakaluwas nga lugar sa sulod sa balay kung maglinog?',
    choices: ['Ilawom sa lig-on nga lamesa', 'Tapad sa bintana', 'Sa sulod sa elevator', 'Sa balkonahe'],
    answer: 0
  },
  {
    question: 'Unsa ang angay buhaton kung naa ka sa gawas samtang maglinog?',
    choices: ['Tago tapad sa mga building', 'Luwas ang mga butang', 'Likayi ang mga kahoy, pader, ug poste', 'Saka sa atop'],
    answer: 2
  },
  {
    question: 'Unsa ang DILI luwas buhaton kung maglinog?',
    choices: ['Tago ilawom sa lamesa', 'Kupot o sandig sa pultahan', 'Likayi ang mga appliances', 'Likayi ang mga salamin'],
    answer: 1
  },
  {
    question: 'Unsa ang pinakaimportante nga butang nga andam kanunay para sa linog?',
    choices: ['Emergency kit o Go Bag', 'Mahalon nga sinina', 'Daghang pagkaon', 'Mga alahas'],
    answer: 0
  },
  {
    question: 'Kung naa ka sa kusina ug kalit lang maglinog, unsa ang una buhaton?',
    choices: ['Ablihan ang oven', 'Layo sa hait nga butang', 'Dagan dayon pagawas', 'Palonga ang stove kung kaya'],
    answer: 3
  },
  {
    question: 'Nganong dili puwede mogamit elevator kung maglinog?',
    choices: ['Kay mas paspas', 'Mawala ang kuryente ug ma-trap ka', 'Kay tugnaw sa sulod', 'Mas layo sa gawas'],
    answer: 1
  },
  {
    question: 'Unsa ang gipasabot sa "aftershock"?',
    choices: ['Mga mosunod nga hinay nga linog', 'Moabot nga bagyo', 'Kusog nga ulan', 'Pagbuto sa bulkan'],
    answer: 0
  },
  {
    question: 'Unsa ang angay buhaton kung naa ka sa sulod sa sakyanan samtang maglinog?',
    choices: ['Parahon sa luwas nga dapit ug magpabilin sa sulod', 'Dagan dayon pagawas', 'Mohunong ilawom sa tulay', 'Magmaneho nga mas paspas'],
    answer: 0
  },
  {
    question: 'Unsa nga butang ang pinakaimportante sa emergency kit kung brownout?',
    choices: ['Flashlight o emergency light', 'Daghan sinina', 'Mga bulak', 'Mga dulaan'],
    answer: 0
  },
  {
    question: 'Kung naa ka sa baybayon ug maglinog, unsa ang angay buhaton?',
    choices: ['Adto sa taas nga lugar tungod sa tsunami', 'Magpabilin lang sa baybayon', 'Languy layo sa baybayon', 'Sakay sa sakayan'],
    answer: 0
  },
  {
    question: 'Unsa ang labing maayong buhaton kung naa ka sa higdaanan samtang maglinog?',
    choices: ['Magpabilin sa higdaanan ug tabunan ang ulo sa unlan', 'Dagan dayon pagawas nga walay sapin', 'Lukso sa bintana', 'Dagan sa kusina'],
    answer: 0
  },
  {
    question: 'Unsa ang angay buhaton kung naa ka sa eskwelahan samtang maglinog?',
    choices: ['Tago ilawom sa desk o lamesa', 'Dagan pagawas bisag wa magsulti ang magtutudlo', 'Lukso sa bintana', 'Magdula sa hallway'],
    answer: 0
  },
  {
    question: 'Unsa ang delikado nga gamiton o sindihan samtang ug pagkahuman sa linog?',
    choices: ['Lig-on nga lamesa', 'Kandila, posporo, o bukas nga siga', 'Sapatos o tsinelas', 'Sakyanan'],
    answer: 1
  },
  {
    question: 'Nganong gikinahanglan ang flashlight sa emergency kit?',
    choices: ['Para makita ug makatabang sa kangitngit', 'Para may dulaan samtang maghulat', 'Para mag-signal sa sakyanan', 'Para pang-selfie'],
    answer: 0
  },
  {
    question: 'Kung naay gas leak pagkahuman sa linog, unsa ang angay buhaton?',
    choices: ['Palonga ang gas ug ablihi ang mga bintana', 'Biyeang abli ang gas tank', 'Sindihan ang kalayo para i-check', 'Singgit lang og tabang'],
    answer: 0
  },
  {
    question: 'Unsa ang angay buhaton kung maglinog samtang naa ka sa sulod sa mall?',
    choices: ['Likayi ang mga salamin ug dagkong suga', 'Maghulat sa elevator', 'Mogamit sa escalator', 'Magpabilin sa tunga sa tindahan'],
    answer: 0
  },
  {
    question: 'Unsa ang DILI apil sa basic emergency kit?',
    choices: ['First aid kit', 'Extra batteries ug powerbank', 'Tubig', 'Litrato sa celebrity'],
    answer: 3
  },
  {
    question: 'Unsa ang angay buhaton kung kusog ang linog samtang nakasakay sa bus?',
    choices: ['Magpabilin nga nalingkod ug kumot pag-ayo', 'Lukso dayon pagawas', 'Tindog ug adto sa driver', 'Maglakaw-lakaw sa aisle'],
    answer: 0
  },
  {
    question: 'Nganong importante ang family emergency plan?',
    choices: ['Para mahibaw-an asa magkita ug unsaon pag-istorya', 'Para mag-away ang pamilya', 'Para i-post sa social media', 'Para sa party'],
    answer: 0
  },
  {
    question: 'Kung naa sa ilawom sa lamesa, unsa ang buhaton sa imong mga kamot?',
    choices: ['Kupot pag-ayo sa tiil sa lamesa', 'Iisa sa hangin', 'Ibutang sa bulsa', 'Gamiton pangmasahe sa ulo'],
    answer: 0
  },
  {
    question: 'Kung naay nabuak nga bintana sa balay tungod sa linog, asa ang angay adtoan?',
    choices: ['Sa tunga sa kwarto, layo sa salamin', 'Tindog tapad sa bintana', 'Tapad sa tag-as nga aparador', 'Ilawom sa bombilya'],
    answer: 0
  },
  {
    question: 'Unsa ang angay likayan kung mohunong na ang pag-uyog sa linog?',
    choices: ['Kalit nga pagsulod sa naguba nga balay', 'Pangita sa pamilya', 'Paggamit sa flashlight', 'Pagtabang sa uban'],
    answer: 0
  },
  {
    question: 'Unsa ang gipasabot sa "DROP, COVER, HOLD ON"?',
    choices: ['Dapa, tago ilawom sa lamesa, ug kumot pag-ayo', 'Dagan, singgit, ug kumot sa pader', 'Lukso, dagan, ug hangyog tabang', 'Tindog, saka, ug hulat'],
    answer: 0
  },
  {
    question: 'Unsa ang buhaton kung mabati nimo ang linog samtang nagluto?',
    choices: ['Palonga dayon ang stove ug layo sa kusina', 'Ipapadayon lang ang pagluto', 'Dagan pagawas dala ang kalaha', 'Maglakaw-lakaw sa kusina'],
    answer: 0
  },
  {
    question: 'Unsa ang pinakaluwas nga paagi sa pagpakig-istorya sa pamilya human sa linog?',
    choices: ['Mag-text o mag-chat kay kasagaran congested ang tawag', 'Magtawag og dugay', 'Mag-live sa social media', 'Ayaw na pagparamdam'],
    answer: 0
  },
  {
    question: 'Kung na-trap ka ilawom sa naguba nga pader, unsa ang labing maayong buhaton?',
    choices: ['Singgit og walay hunong', 'Toktok o bunal sa pader/tubo para madungog sa rescuers', 'Matulog na lang', 'Sulayan pag-alsa ang pader mag-usa'],
    answer: 1
  },
  {
    question: 'Unsa ang angay buhaton sa bug-at nga appliances o estante sa balay bag-o pa maglinog?',
    choices: ['I-anchor o higot pag-ayo sa pader', 'Ibutang sa ibabaw sa refrigerator', 'Biyean lang sa tunga sa agianan', 'Ibutang sa atubangan sa pultahan'],
    answer: 0
  },
  {
    question: 'Unsa nga ahensya sa gobyerno sa Pilipinas ang nagbantay sa mga linog ug bulkan?',
    choices: ['PAGASA', 'PHIVOLCS', 'DENR', 'DepEd'],
    answer: 1
  },
  {
    question: 'Pila ka tubig ang ideal nga i-storage kada tawo kada adlaw sa emergency kit?',
    choices: ['Usa ka baso lang', 'Usa ka galon (mga 4 liters)', 'Usa ka sachet', 'Wala, may softdrinks raman'],
    answer: 1
  },
  {
    question: 'Unsa nga klase sa pagkaon ang labing angay ibutang sa imong Go Bag?',
    choices: ['Pagkaon nga daling mapanis sama sa kan-on', 'Frozen nga pagkaon', 'Ready-to-eat o canned goods nga dili na lutuon', 'Hilaw nga karne'],
    answer: 2
  },
  {
    question: 'Kung naa kay kauban nga tigulang o may kapansanan sa balay, kanus-a nimo plano ang ilang paglikas?',
    choices: ['Karon pa lang, bag-o pa maglinog', 'Kung naguba na ang balay', 'Human sa usa ka semana', 'Ibiya na lang sa silingan'],
    answer: 0
  },
  {
    question: 'Unsa ang angay buhaton kung makakita ka og nasamdan human sa linog ug luwas ang inyong lugar?',
    choices: ['I-video ug i-post sa TikTok', 'Biyean ug dagan pagawas', 'Pangita og tabang ug butangi og first aid kung kahibalo ka', 'Birahon dayon bisag naay injury sa liog'],
    answer: 2
  },
  {
    question: 'Unsa ang tawag sa sabay-sabay nga earthquake drill sa tibuok Pilipinas?',
    choices: ['NSED (National Simultaneous Earthquake Drill)', 'Fun Run', 'Grand Fiesta', 'Barangay Assembly'],
    answer: 0
  },
  {
    question: 'Kung naa ka sa sinehan o auditorium samtang maglinog, unsa ang imong buhaton?',
    choices: ['Mag-unahan sa exit para makagawas dayon', 'Tago ilawom o tunga sa mga lingkoranan ug protektahan ang ulo', 'Saka sa entablado', 'Singgit para ma-panic ang tanan'],
    answer: 1
  },
  {
    question: 'Nganong importante nga palongon ang main switch sa kuryente (circuit breaker) bag-o molikas human sa linog?',
    choices: ['Para makatipid sa kuryente', 'Para malikayan ang sunog gikan sa naguba nga mga wire', 'Para dili mabuak ang TV', 'Para mangitngit ang balay'],
    answer: 1
  },
  {
    question: 'Pila ka subay dapat i-check ug ilisan ang mga butang sa imong emergency Go Bag?',
    choices: ['Kung naay linog lang', 'Kausa lang sa napulo ka tuig', 'Kada 6 ka bulan hangtod 1 ka tuig para ma-check ang expiration', 'Kada adlaw bag-o mogawas'],
    answer: 2
  },
  {
    question: 'Unsa nga klase sa sapin ang labing maayo isul-ob kung molikas human sa linog?',
    choices: ['Slippers o high heels', 'Bagà ug sirado nga sapatos para malikayan ang bubog o pako', 'Bisan unsa, bisag dili komportable', 'Ayaw na pagsapatos, maglakaw nga nakapa'],
    answer: 1
  },
  {
    question: 'Kung nagpuyo ka duol sa tiilan sa bukid, unsa kapeligro ang angay bantayan human sa kusog nga linog?',
    choices: ['Tsunami', 'Landslide o pagguho sa yuta', 'Baha', 'Pagbuto sa bulkan'],
    answer: 1
  },
  {
    question: 'Unsa ang pangunang katuyoan sa pag-duck, cover, ug hold kung maglinog?',
    choices: ['Para dili ka makita sa ubang tawo', 'Para maprotektahan ang imong kaugalingon sa mga mahulog nga butang', 'Para makapahulay samtang maglinog', 'Para mag-ehersisyo'],
    answer: 1
  }
];

// ─── Choose active language at module load time ──────────────
const _lang = (typeof localStorage !== 'undefined') ? (localStorage.getItem('javiLang') || 'tl') : 'tl';
export const QUIZ_QUESTIONS =
  _lang === 'en' ? QUIZ_EN :
  _lang === 'ceb' ? QUIZ_CEB :
  QUIZ_TL;