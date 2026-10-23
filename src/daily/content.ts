// The Daily's built-in items (DESIGN.md §10.5): one of each is picked per day, the same for everyone that day.
// Kept family-friendly; quotes are ones with well-documented sources (many famous quotes are misattributed).

export interface Word {
  word: string
  pos: string
  meaning: string
  example: string
}

export const WORDS: Word[] = [
  { word: 'ephemeral', pos: 'adjective', meaning: 'lasting a very short time', example: 'The rainbow was ephemeral, gone before we found the camera.' },
  { word: 'gregarious', pos: 'adjective', meaning: 'fond of company; sociable', example: 'Our gregarious puppy greets every visitor at the door.' },
  { word: 'meticulous', pos: 'adjective', meaning: 'showing great attention to detail', example: 'She was meticulous about labeling every jar in the pantry.' },
  { word: 'resilient', pos: 'adjective', meaning: 'able to recover quickly from difficulties', example: 'The garden was resilient and bloomed again after the storm.' },
  { word: 'candid', pos: 'adjective', meaning: 'truthful and straightforward', example: 'He gave a candid answer about why the cookies were missing.' },
  { word: 'serendipity', pos: 'noun', meaning: 'finding something good without looking for it', example: 'By serendipity, we found our favorite café on a wrong turn.' },
  { word: 'benevolent', pos: 'adjective', meaning: 'well-meaning and kind', example: 'A benevolent neighbor shoveled everyone’s sidewalk.' },
  { word: 'diligent', pos: 'adjective', meaning: 'careful and hardworking', example: 'A diligent student checks her answers before handing in a test.' },
  { word: 'curious', pos: 'adjective', meaning: 'eager to know or learn something', example: 'The curious kitten explored every box in the garage.' },
  { word: 'eloquent', pos: 'adjective', meaning: 'fluent and persuasive in speaking or writing', example: 'Her eloquent speech convinced the class to plant a garden.' },
  { word: 'frugal', pos: 'adjective', meaning: 'careful with money; not wasteful', example: 'Being frugal, they saved their allowance for a big trip.' },
  { word: 'habitat', pos: 'noun', meaning: 'the natural home of an animal or plant', example: 'The wetland is a habitat for frogs and herons.' },
  { word: 'innovate', pos: 'verb', meaning: 'to introduce new ideas or methods', example: 'The team innovated a faster way to fold the laundry.' },
  { word: 'jubilant', pos: 'adjective', meaning: 'feeling or showing great happiness', example: 'The crowd was jubilant when the home team scored.' },
  { word: 'kinetic', pos: 'adjective', meaning: 'relating to motion', example: 'A rolling ball has kinetic energy.' },
  { word: 'luminous', pos: 'adjective', meaning: 'giving off light; bright', example: 'The luminous moon lit the path home.' },
  { word: 'nocturnal', pos: 'adjective', meaning: 'active at night', example: 'Owls are nocturnal and hunt after dark.' },
  { word: 'optimistic', pos: 'adjective', meaning: 'hopeful about the future', example: 'Even with clouds in the sky, he was optimistic about the picnic.' },
  { word: 'persevere', pos: 'verb', meaning: 'to keep trying despite difficulty', example: 'She persevered until she could ride without training wheels.' },
  { word: 'quaint', pos: 'adjective', meaning: 'attractively unusual or old-fashioned', example: 'We stayed in a quaint cottage with a red door.' },
  { word: 'reluctant', pos: 'adjective', meaning: 'unwilling or hesitant', example: 'The dog was reluctant to step into the bath.' },
  { word: 'tenacious', pos: 'adjective', meaning: 'holding firmly; not giving up', example: 'The tenacious climber reached the top on her third try.' },
  { word: 'unanimous', pos: 'adjective', meaning: 'agreed by everyone', example: 'The vote for pizza night was unanimous.' },
  { word: 'vivid', pos: 'adjective', meaning: 'producing strong, clear images; bright', example: 'She painted a vivid sunset in orange and pink.' },
  { word: 'whimsical', pos: 'adjective', meaning: 'playfully quaint or fanciful', example: 'The book had whimsical drawings of dancing teapots.' },
  { word: 'zeal', pos: 'noun', meaning: 'great energy or enthusiasm', example: 'He cleaned his room with surprising zeal before the party.' },
  { word: 'abundant', pos: 'adjective', meaning: 'existing in large quantities; plentiful', example: 'Apples were abundant in the orchard this fall.' },
  { word: 'camouflage', pos: 'noun', meaning: 'coloring that helps something blend in', example: 'The chameleon’s camouflage made it hard to spot.' },
  { word: 'empathy', pos: 'noun', meaning: 'understanding and sharing another person’s feelings', example: 'Showing empathy, she sat with her friend who felt sad.' },
  { word: 'perspective', pos: 'noun', meaning: 'a particular way of seeing things', example: 'From the top of the hill, we had a new perspective on the town.' },
  { word: 'ingenious', pos: 'adjective', meaning: 'clever, original and inventive', example: 'He built an ingenious bird feeder from a milk carton.' },
]

export interface Quote {
  text: string
  by: string
}

export const QUOTES: Quote[] = [
  { text: 'The journey of a thousand miles begins with one step.', by: 'Lao Tzu, Tao Te Ching' },
  { text: 'Not all those who wander are lost.', by: 'J.R.R. Tolkien, The Fellowship of the Ring' },
  { text: 'Do. Or do not. There is no try.', by: 'Yoda, The Empire Strikes Back' },
  { text: 'The best way out is always through.', by: 'Robert Frost, “A Servant to Servants”' },
  { text: 'Imagination is more important than knowledge.', by: 'Albert Einstein, 1929 interview' },
  { text: 'The more that you read, the more things you will know. The more that you learn, the more places you’ll go.', by: 'Dr. Seuss, I Can Read With My Eyes Shut!' },
  { text: 'It does not do to dwell on dreams and forget to live.', by: 'Albus Dumbledore, Harry Potter and the Philosopher’s Stone' },
  { text: 'Not everything that is faced can be changed, but nothing can be changed until it is faced.', by: 'James Baldwin' },
  { text: 'Darkness cannot drive out darkness; only light can do that. Hate cannot drive out hate; only love can do that.', by: 'Martin Luther King Jr., Strength to Love' },
  { text: 'One child, one teacher, one book, one pen can change the world.', by: 'Malala Yousafzai, United Nations, 2013' },
  { text: 'The Earth is the cradle of humanity, but one cannot live in a cradle forever.', by: 'Konstantin Tsiolkovsky, 1911' },
  { text: 'We are made of star-stuff.', by: 'Carl Sagan, Cosmos' },
  { text: 'Life is like riding a bicycle. To keep your balance, you must keep moving.', by: 'Albert Einstein, letter to his son, 1930' },
  { text: 'The woods are lovely, dark and deep, but I have promises to keep, and miles to go before I sleep.', by: 'Robert Frost, “Stopping by Woods on a Snowy Evening”' },
  { text: '“Hope” is the thing with feathers that perches in the soul.', by: 'Emily Dickinson' },
  { text: 'Two roads diverged in a wood, and I— I took the one less traveled by, and that has made all the difference.', by: 'Robert Frost, “The Road Not Taken”' },
  { text: 'Do what you can, with what you have, where you are.', by: 'Theodore Roosevelt (quoting Squire Bill Widener)' },
  { text: 'In three words I can sum up everything I’ve learned about life: it goes on.', by: 'Robert Frost' },
  { text: 'The only thing we have to fear is fear itself.', by: 'Franklin D. Roosevelt, 1933' },
  { text: 'Ask not what your country can do for you—ask what you can do for your country.', by: 'John F. Kennedy, 1961' },
  { text: 'That’s one small step for man, one giant leap for mankind.', by: 'Neil Armstrong, 1969' },
  { text: 'You’re braver than you believe, and stronger than you seem, and smarter than you think.', by: 'Christopher Robin, Pooh’s Grand Adventure' },
  { text: 'Happiness can be found, even in the darkest of times, if one only remembers to turn on the light.', by: 'Albus Dumbledore, Harry Potter and the Prisoner of Azkaban (film)' },
  { text: 'To be, or not to be: that is the question.', by: 'William Shakespeare, Hamlet' },
  { text: 'If you want to go fast, go alone. If you want to go far, go together.', by: 'African proverb' },
]

export interface Thought {
  question: string
  thought: string
}

/** A small question to think about (a mini philosophy), and a thought to compare with yours. */
export const THOUGHTS: Thought[] = [
  { question: 'If you replace every part of a bicycle one at a time, is it still the same bicycle?', thought: 'This is the “Ship of Theseus” puzzle. Some say it stays the same because it changed gradually; others say it’s new. What makes you the same person you were as a baby?' },
  { question: 'Is it ever right to break a rule?', thought: 'Rules usually exist to protect people. Sometimes following a rule would cause harm (like keeping quiet when someone is in danger). Thinking about why a rule exists helps decide.' },
  { question: 'If no one ever found out, would it still matter if you were unkind?', thought: 'Many thinkers say character is what we do when no one is watching. Kindness changes the other person’s day, and it changes who we become.' },
  { question: 'Can you be friends with someone who disagrees with you about something important?', thought: 'Lots of good friendships include disagreements. Listening to understand, not just to win, is a skill that makes friendships stronger.' },
  { question: 'Is a hot dog a sandwich?', thought: 'It depends on how you define “sandwich”. This silly question shows how much of thinking is about definitions: agree on what words mean before you argue.' },
  { question: 'Would you rather know everything, or be able to learn anything quickly?', thought: 'Knowing everything might take the fun out of discovery. Being a fast learner keeps curiosity alive. What do you enjoy more: knowing, or finding out?' },
  { question: 'Does a tree falling in an empty forest make a sound?', thought: 'It makes vibrations in the air either way. Whether that counts as “sound” depends on whether sound means the vibration or the hearing of it.' },
  { question: 'Is it better to be good at many things or great at one thing?', thought: 'Both have value: a generalist connects ideas, a specialist goes deep. Most people end up with a few deep interests and many shallow ones.' },
  { question: 'If you could make one rule everyone in the world had to follow, what would it be?', thought: 'Many traditions arrive at a similar one: treat others the way you would want to be treated. Would your rule work for everyone, everywhere?' },
  { question: 'Are you the same person you were yesterday?', thought: 'Your cells, memories and ideas change a little every day, yet you still feel like “you”. Maybe a self is more like a river than a rock.' },
  { question: 'What makes something fair?', thought: 'Fair can mean everyone gets the same, or everyone gets what they need, or everyone gets what they earned. Different situations call for different kinds of fair.' },
  { question: 'Can a robot be kind?', thought: 'A robot can act kindly. Whether it means it depends on whether kindness is about actions or about feelings behind them.' },
  { question: 'Is it possible to be brave without being scared?', thought: 'Many say courage isn’t the absence of fear but doing the right thing even when you’re afraid.' },
  { question: 'If everyone told the truth all the time, would the world be better?', thought: 'Honesty builds trust, but kindness matters in how we say true things. “Honest and kind” might be better than “honest at all costs”.' },
  { question: 'Do you own your ideas?', thought: 'Ideas grow from things we learned from others. Sharing an idea doesn’t make you have less of it—that’s different from sharing a cookie.' },
  { question: 'What is more important: being right or being kind?', thought: 'Usually you don’t have to choose—you can be right in a kind way. When they clash, think about what matters more in that moment.' },
  { question: 'Why do we enjoy sad songs and scary movies?', thought: 'Feeling big emotions in a safe place can be satisfying, help us understand ourselves, and make us feel connected to others who feel the same.' },
  { question: 'Is boredom good for you?', thought: 'Boredom often comes just before creativity—it pushes us to invent games, ideas and projects.' },
  { question: 'Should animals have rights?', thought: 'Many people think animals can feel pain and joy, so they deserve care. People disagree about how far that should go—what do you think, and why?' },
  { question: 'What would happen if no one ever made mistakes?', thought: 'Mistakes are how we learn what doesn’t work. A world with no mistakes might also be a world with very little learning.' },
  { question: 'Can something be beautiful if no one sees it?', thought: 'Some think beauty is in the thing itself; others think it’s in the eye of the beholder. A sunset on another planet is a fun case to think about.' },
  { question: 'Is it better to have lots of friends or a few close ones?', thought: 'Different people thrive with different social lives. Studies suggest close, trusting relationships matter most for happiness.' },
  { question: 'If you could live forever, would you want to?', thought: 'Forever is a long time. Some say endings give life meaning; others would love more time to learn and explore. What would you do with all that time?' },
  { question: 'Does practice make perfect?', thought: 'Practice makes progress. “Perfect practice makes perfect” is closer: practicing the right way, with feedback, matters.' },
  { question: 'How do you know what you know?', thought: 'We learn from senses, reasoning, and trusting others. Asking “how do I know?” is the start of a whole branch of philosophy called epistemology.' },
]

export interface Fact {
  question: string
  answer: string
}

/** A science question with its answer (guess first). */
export const FACTS: Fact[] = [
  { question: 'Why is the sky blue?', answer: 'Sunlight contains every color. Air molecules scatter short blue wavelengths much more than red ones, so blue light comes at us from all over the sky.' },
  { question: 'How long does sunlight take to reach Earth?', answer: 'About 8 minutes and 20 seconds. The Sun is about 150 million km (93 million miles) away.' },
  { question: 'How many bones does an adult human have?', answer: '206. Babies are born with around 300; many fuse together as they grow.' },
  { question: 'Why do we have seasons?', answer: 'Earth’s axis is tilted about 23.5°. As we orbit the Sun, each hemisphere tilts toward it (summer) or away from it (winter). It isn’t about distance.' },
  { question: 'What is the largest planet in our solar system?', answer: 'Jupiter. More than 1,300 Earths could fit inside it.' },
  { question: 'Why do leaves change color in the fall?', answer: 'Trees stop making green chlorophyll as days shorten. Yellows and oranges that were there all along show through, and some trees make new red pigments.' },
  { question: 'How fast does light travel?', answer: 'About 300,000 km (186,000 miles) per second—fast enough to circle Earth about 7.5 times in one second.' },
  { question: 'What gas do plants take in to make food?', answer: 'Carbon dioxide. With sunlight and water, plants turn it into sugar and release oxygen (photosynthesis).' },
  { question: 'Why does the Moon change shape?', answer: 'It doesn’t—half of it is always lit by the Sun. As it orbits Earth, we see different amounts of the lit half (the phases).' },
  { question: 'What is the hardest natural substance?', answer: 'Diamond, a form of pure carbon whose atoms are locked in a very strong pattern.' },
  { question: 'Why do cats’ eyes shine in the dark?', answer: 'A mirror-like layer behind the retina (the tapetum lucidum) reflects light back through the eye, helping them see in dim light.' },
  { question: 'How many hearts does an octopus have?', answer: 'Three: two pump blood through the gills, one pumps it to the rest of the body. Their blood is blue.' },
  { question: 'Why does ice float?', answer: 'Water expands when it freezes, so ice is less dense than liquid water. That’s why lakes freeze from the top down, protecting the fish below.' },
  { question: 'What causes thunder?', answer: 'Lightning heats the air to around 27,000 °C (about 50,000 °F) in an instant—hotter than the surface of the Sun. The air expands so fast it makes a shock wave we hear as thunder.' },
  { question: 'How can you tell how far away a storm is?', answer: 'Count the seconds between the flash and the thunder and divide by 5 for miles (or by 3 for kilometers). Sound is much slower than light.' },
  { question: 'Which planet has the longest day?', answer: 'Venus. It spins so slowly that one day there (243 Earth days) is longer than its year (225 Earth days).' },
  { question: 'What is the closest star to Earth?', answer: 'The Sun! The next closest is Proxima Centauri, about 4.2 light-years away.' },
  { question: 'Why do we yawn?', answer: 'Scientists aren’t completely sure. One idea is that yawning helps cool the brain. Yawns are contagious—even reading about them can start one.' },
  { question: 'How do bees make honey?', answer: 'They collect flower nectar, add enzymes, store it in wax cells and fan it with their wings until most of the water evaporates.' },
  { question: 'What is the biggest animal that has ever lived?', answer: 'The blue whale—bigger than any dinosaur known. Its heart is about the size of a golf cart.' },
  { question: 'Why does a spoon look bent in a glass of water?', answer: 'Light bends (refracts) when it moves between water and air, so the part under water appears shifted.' },
  { question: 'What makes a rainbow?', answer: 'Raindrops act like tiny prisms: sunlight bends going in, reflects off the back of the drop, and bends again coming out, splitting into colors.' },
  { question: 'How long is a year on Mars?', answer: 'About 687 Earth days—almost two Earth years.' },
  { question: 'Why do onions make you cry?', answer: 'Cutting an onion releases a gas that turns into a mild irritant when it meets the water in your eyes, so your eyes make tears to wash it away.' },
  { question: 'What is the only mammal that can truly fly?', answer: 'The bat. (Flying squirrels glide; bats flap their wings.)' },
  { question: 'Why is the ocean salty?', answer: 'Rain slowly dissolves minerals from rocks, and rivers carry them to the sea. When water evaporates, the salt stays behind.' },
  { question: 'How many times does your heart beat in a day?', answer: 'Around 100,000 times—about 35 million times a year.' },
  { question: 'What are clouds made of?', answer: 'Tiny water droplets or ice crystals, so small and light they float on rising air.' },
  { question: 'Why do we see lightning before we hear thunder?', answer: 'Light travels about a million times faster than sound.' },
  { question: 'Can a sneeze travel faster than a car on the highway?', answer: 'Measurements vary, but sneezes can leave your nose at tens of miles per hour—cover your sneezes!' },
]

export interface Riddle {
  riddle: string
  answer: string
}

export const RIDDLES: Riddle[] = [
  { riddle: 'What has keys but can’t open locks?', answer: 'A piano.' },
  { riddle: 'What has to be broken before you can use it?', answer: 'An egg.' },
  { riddle: 'I’m tall when I’m young, and short when I’m old. What am I?', answer: 'A candle.' },
  { riddle: 'What month of the year has 28 days?', answer: 'All of them!' },
  { riddle: 'What is full of holes but still holds water?', answer: 'A sponge.' },
  { riddle: 'What question can you never answer yes to?', answer: '“Are you asleep yet?”' },
  { riddle: 'What goes up but never comes down?', answer: 'Your age.' },
  { riddle: 'What has hands but can’t clap?', answer: 'A clock.' },
  { riddle: 'What gets wetter the more it dries?', answer: 'A towel.' },
  { riddle: 'What can you catch, but not throw?', answer: 'A cold.' },
  { riddle: 'What has a head and a tail but no body?', answer: 'A coin.' },
  { riddle: 'What has many teeth but can’t bite?', answer: 'A comb.' },
  { riddle: 'What has legs but doesn’t walk?', answer: 'A table.' },
  { riddle: 'What can travel around the world while staying in a corner?', answer: 'A stamp.' },
  { riddle: 'The more of this there is, the less you see. What is it?', answer: 'Darkness.' },
  { riddle: 'What has one eye but can’t see?', answer: 'A needle.' },
  { riddle: 'What runs but never walks, has a mouth but never talks?', answer: 'A river.' },
  { riddle: 'What belongs to you, but other people use it more than you do?', answer: 'Your name.' },
  { riddle: 'What has a neck but no head?', answer: 'A bottle.' },
  { riddle: 'What can you hold in your right hand, but never in your left hand?', answer: 'Your left hand (or elbow)!' },
  { riddle: 'If you have me, you want to share me. If you share me, you don’t have me. What am I?', answer: 'A secret.' },
  { riddle: 'What has words, but never speaks?', answer: 'A book.' },
  { riddle: 'What invention lets you look right through a wall?', answer: 'A window.' },
  { riddle: 'What kind of band never plays music?', answer: 'A rubber band.' },
  { riddle: 'Where does today come before yesterday?', answer: 'In the dictionary.' },
  { riddle: 'What has four wheels and flies?', answer: 'A garbage truck.' },
  { riddle: 'I shave every day, but my beard stays the same. Who am I?', answer: 'A barber.' },
  { riddle: 'What building has the most stories?', answer: 'The library.' },
  { riddle: 'What is always in front of you but can’t be seen?', answer: 'The future.' },
  { riddle: 'What comes once in a minute, twice in a moment, but never in a thousand years?', answer: 'The letter M.' },
]
