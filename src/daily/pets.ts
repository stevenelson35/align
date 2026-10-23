// The Daily's pet items: a pet health tip (built in, from well-established veterinary guidance such as the ASPCA
// and AVMA; not a substitute for a vet), and a fun dog or cat fact fetched from public trivia sites (not vet-checked).

export interface PetTip {
  tip: string
  more: string
}

export const PET_TIPS: PetTip[] = [
  { tip: 'Chocolate is toxic to dogs and cats.', more: 'It contains theobromine and caffeine; the darker the chocolate (and baking chocolate especially), the more dangerous a small amount is.' },
  { tip: 'Xylitol can be deadly to dogs.', more: 'This sweetener (sugar-free gum, candy, some peanut butters and baked goods) can cause a sudden drop in blood sugar and liver failure in dogs.' },
  { tip: 'Grapes and raisins can cause kidney failure in dogs.', more: 'Even small amounts have caused problems in some dogs, and it isn’t predictable which dogs are affected—so avoid them entirely.' },
  { tip: 'Lilies are extremely dangerous to cats.', more: 'True lilies and daylilies can cause kidney failure in cats; even the pollen or the water in the vase. Call a vet right away if a cat may have chewed one.' },
  { tip: 'Onions, garlic and chives harm dogs and cats.', more: 'They damage red blood cells (anemia), whether raw, cooked or powdered—watch out for foods seasoned with them.' },
  { tip: 'In Florida, heartworm prevention is year-round.', more: 'Heartworm is spread by mosquitoes. The American Heartworm Society recommends prevention all year for dogs and cats.' },
  { tip: 'Never give pets human pain relievers.', more: 'Ibuprofen, naproxen and acetaminophen can cause serious harm; cats are especially sensitive to acetaminophen. Ask your vet for a safe option.' },
  { tip: 'A dog’s normal temperature is higher than ours.', more: 'About 101–102.5 °F (38.3–39.2 °C) for dogs, and about 100.5–102.5 °F for cats.' },
  { tip: 'The 7-second pavement test.', more: 'If you can’t hold the back of your hand on the pavement for 7 seconds, it’s too hot for paws. Walk early or late on hot days.' },
  { tip: 'Never leave a pet in a parked car.', more: 'On a 70 °F day, the inside of a car can reach about 89 °F in 10 minutes—and keep climbing, even with the windows cracked.' },
  { tip: 'Flat-faced breeds overheat easily.', more: 'Pugs, bulldogs, Boston terriers and similar breeds have a harder time cooling by panting. Keep exercise gentle in heat.' },
  { tip: 'Dental disease is very common.', more: 'Most dogs and cats show some signs of dental disease by age three. Regular brushing and dental checkups help.' },
  { tip: 'Cats hide pain.', more: 'Changes in eating, grooming, hiding, or litter box habits can be the first signs a cat is unwell.' },
  { tip: 'A male cat straining to pee is an emergency.', more: 'Straining in the litter box with little or no urine can mean a urinary blockage, which can be life-threatening within hours.' },
  { tip: 'Bloat is an emergency in large dogs.', more: 'Retching without bringing anything up, a swollen belly and restlessness in a deep-chested dog can mean bloat (GDV). Go to a vet immediately.' },
  { tip: 'Rabies vaccination is required in Florida.', more: 'Florida law requires dogs, cats and ferrets to be vaccinated against rabies by a licensed veterinarian once they are 4 months old.' },
  { tip: 'Keep microchip info up to date.', more: 'A microchip only helps a lost pet come home if the registration has your current phone number and address.' },
  { tip: 'Save the ASPCA Animal Poison Control number.', more: '(888) 426-4435, open 24/7. A consultation fee may apply. Your own vet or an emergency clinic is also a good first call.' },
  { tip: 'Florida’s cane toads are toxic to dogs.', more: 'If a dog mouths a toad: wipe the gums and tongue with a damp cloth, rinse the mouth (pointing the head down so water runs out), and call a vet right away.' },
  { tip: 'Sago palms are highly toxic to dogs.', more: 'Common in Florida yards; all parts are poisonous, especially the seeds, and can cause liver failure.' },
  { tip: 'Treat every pet for fleas.', more: 'A single female flea can lay dozens of eggs a day, most of which fall off into the home—so treat all the pets in the house, not just the itchy one.' },
  { tip: 'Cats need meat.', more: 'Cats are obligate carnivores and need nutrients such as taurine found in animal protein; dog food doesn’t meet a cat’s needs.' },
  { tip: 'Senior pets benefit from more checkups.', more: 'From about age 7 (earlier for giant breeds), many vets recommend a checkup every six months, since problems can develop faster.' },
  { tip: 'Removing a tick.', more: 'Grasp it with fine-tipped tweezers close to the skin and pull upward with steady pressure; then clean the spot. Don’t twist or burn it.' },
  { tip: 'String, ribbon and tinsel are dangerous for cats.', more: 'If swallowed they can bunch up the intestines (a “linear foreign body”), which often needs surgery. Never pull on string you see in a pet’s mouth or bottom.' },
  { tip: 'Antifreeze is deadly in tiny amounts.', more: 'Ethylene glycol tastes sweet to pets; a few licks can be fatal. Clean up spills and store it out of reach.' },
  { tip: 'A quick hydration check.', more: 'Gently lift the skin between the shoulder blades: it should snap back quickly. Slow return, dry gums or sunken eyes can mean dehydration.' },
  { tip: 'Sudden weight changes matter.', more: 'Unexplained weight loss or gain can point to problems like diabetes, thyroid disease or kidney disease—worth a vet visit.' },
]

/** A fun fact about dogs (even days) or cats (odd days), from free trivia sites (not vet-checked). */
export async function fetchPetFact(dayIndex: number): Promise<{ animal: 'Dog' | 'Cat'; fact: string }> {
  const dog = dayIndex % 2 === 0
  const r = await fetch(dog ? 'https://dogapi.dog/api/v2/facts?limit=1' : 'https://catfact.ninja/fact', { headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error(`${r.status}`)
  const j = await r.json()
  const fact = dog ? j.data?.[0]?.attributes?.body : j.fact
  if (!fact) throw new Error('no fact')
  return { animal: dog ? 'Dog' : 'Cat', fact: String(fact) }
}
