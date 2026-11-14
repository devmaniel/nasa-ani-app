/* Growing guides: sample content from the master, not from an agricultural source. The same topics for every crop. */
import { Bean, Bug, Droplet, Leaf, ShoppingBasket, Shovel, Sprout } from 'lucide-react'
import { TbPaperBag } from 'react-icons/tb'
import type { IconType, Tone } from './types'

export const GD_TOPICS = ['Land preparation', 'Seed and variety', 'Planting', 'Water and saving water', 'Fertilizer', 'Weeds', 'Pests and diseases', 'Harvest and after harvest'];
export const GD_TOPIC_ICON: Record<string, [IconType, Tone]> = {
  'Land preparation':[Shovel, 'soil'], 'Seed and variety':[Bean, 'grow'], 'Planting':[Sprout, 'grow'], 'Water and saving water':[Droplet, 'water'],
  'Fertilizer':[TbPaperBag, 'feed'], 'Weeds':[Leaf, 'grow'], 'Pests and diseases':[Bug, 'pest'], 'Harvest and after harvest':[ShoppingBasket, 'harvest']
};
export const GD_NAME: Record<string, string> = { 'Mung bean':'Monggo' };   // the master's name for a crop, when it differs
export const GD_CROP: Record<string, string[][]> = {
  Monggo: [
    ['Plough once or twice and harrow to a fine, loose soil.', 'No puddling: monggo rots in standing water. On a paddy, cut shallow drains every few metres.', 'After rice, you can also sow without ploughing, straight into the moist stubble.'],
    ['Use clean, certified seed of a variety recommended for your area.', 'About 20–25 kg covers a hectare.', 'Throw out shrivelled, broken or insect-damaged seeds.'],
    ['Sow while the soil is still moist, right after the rice harvest or a good rain.', 'Rows 50 cm apart, 2–3 seeds every 10 cm, 2–3 cm deep.', 'Thin to one or two plants per hill after 2 weeks.'],
    ['Needs little water: once at sowing if the soil is dry, then at flowering and when the pods fill.', 'Cover the rows with rice straw to keep the moisture in.', 'Never let water stand in the field. Open the drains after heavy rain.'],
    ['Makes its own nitrogen, so it needs little fertilizer.', 'On poor soil, a small dose of complete fertilizer at planting is enough.'],
    ['Weed at 2 weeks and again at 4 weeks, before the plants close over the rows.', 'After that, the plants shade out most weeds.'],
    ['Pod borers and aphids once it flowers. Check the pods every few days.', 'Leaf spots and powdery mildew in humid weather. Pull out badly hit plants.', 'Yellow leaves dropping early: it is short of water.'],
    ['Ready in about 60 days. Pick the pods when they turn black or brown, over 2–3 pickings.', 'Dry the pods in the sun for 2–3 days, then thresh.', 'Store dry seed in sealed containers. Leave the stalks on the field: they feed the soil for the next crop.']
  ],
  'Sweet potato': [
    ['Plough deep and break up clods: the roots need loose soil to swell.', 'Form ridges 75–100 cm apart, about 30 cm high.'],
    ['Cut 25–30 cm tips from healthy vines, free of weevil damage.', 'Plant the cuttings within a day or two of cutting.'],
    ['Push two-thirds of each cutting into the ridge, 25–30 cm apart.', 'Plant late in the day so the cuttings do not wilt.'],
    ['Water every few days for the first 2 weeks, until the cuttings root.', 'After that it copes with dry spells. Once the vines cover the ground, they keep the soil moist.'],
    ['Apply complete fertilizer at planting.', 'Too much nitrogen gives big vines and small roots.'],
    ['Weed until the vines close over the ridges, usually the first 6 weeks.', 'Lift the vines now and then so they do not root along the ground.'],
    ['Sweet potato weevil: cracks in dry soil let it reach the roots. Pile soil back over the cracks.', 'Use clean cuttings and do not plant the same field again right away.'],
    ['Dig carefully at 3½–4 months, without bruising the roots.', 'Let them cure in the shade for a few days before storing or selling.', 'Do not leave them in the ground too long: weevil damage grows.']
  ],
  Rice: [
    ['Fix the levees so the field holds water.', 'Plough, flood and puddle the soil, then level it so the water spreads evenly.'],
    ['Use certified seed of a variety recommended for your area; a short-maturing one in a dry year.', 'Soak the seed for a day, then let it sprout for a day or two before sowing.', 'About 40 kg of seed is enough for a hectare when transplanting.'],
    ['Sow a seedbed about 3 weeks before transplanting.', 'Transplant 20–25 day seedlings, 20 × 20 cm apart, 2–3 per hill.', 'Or sow straight into the field if labour or water is short.'],
    ['Save water with alternate wetting and drying: let the water drop below the soil surface, then flood again.', 'Keep standing water from a week before flowering until the grains fill.', 'Drain the field about 2 weeks before harvest.'],
    ['Split the fertilizer: some at planting, the rest at tillering and when the panicle starts.', 'A leaf colour chart helps you add nitrogen only when the leaves need it.'],
    ['Weed in the first 40 days: by hand, with a rotary weeder, or by keeping water on the field.', 'Good levelling and early flooding keep most weeds down.'],
    ['Stem borers: dead hearts and white, empty panicles.', 'Tungro and bacterial leaf blight: yellow or orange leaves. Ask the municipal agriculturist if many plants are hit.', 'Leaves rolling at midday while it flowers: it needs water now.'],
    ['Harvest when most grains (80–85%) are straw coloured, about 110 days after sowing.', 'Thresh soon after cutting.', 'Dry the grain to about 14% moisture before storing it in a cool, dry place.']
  ],
  Corn: [
    ['Plough and harrow twice to a fine soil.', 'Open furrows 75 cm apart.'],
    ['Use certified seed of a hybrid or open-pollinated variety recommended for your area.', 'About 18–20 kg covers a hectare.'],
    ['One seed every 20–25 cm, 3–5 cm deep, into moist soil.', 'Plant at the start of the rains, or when water is sure.'],
    ['Water matters most when the tassels and silks come out. Do not let the soil dry then.', 'Water along the furrows rather than flooding the whole field.'],
    ['Apply complete fertilizer at planting.', 'Side-dress nitrogen and hill up the soil at 3–4 weeks.'],
    ['Weed in the first month. Hilling up also buries small weeds.'],
    ['Fall armyworm in the leaf whorl: ragged holes and sawdust-like droppings.', 'Corn borer: holes in the stalk and broken tassels.', 'Leaves rolling at midday: it is short of water.'],
    ['Harvest when the husks are dry and the kernels are hard, about 100–110 days.', 'Dry the cobs well before shelling, and store the grain dry to keep mould away.']
  ],
  Eggplant: [
    ['Plough and harrow, then make raised beds or ridges.'],
    ['Raise seedlings in trays or a seedbed for 4–5 weeks.'],
    ['Transplant 50–75 cm apart in rows about 1 m apart.', 'Plant in the late afternoon and water right away.'],
    ['Needs regular water while it flowers and fruits.', 'Watering at the base, or with drip lines, saves water. Mulch keeps it in.'],
    ['Apply complete fertilizer at planting, then side-dress every few weeks while it fruits.'],
    ['Keep the beds weeded until the plants are big. Mulch helps.'],
    ['Fruit and shoot borer: wilting tips and holes in the fruit. Cut off and destroy the damaged parts.', 'Bacterial wilt: whole plants wilt suddenly. Do not replant eggplant, tomato or pepper there.'],
    ['First picking about 2 months after transplanting, then every few days for several weeks.', 'Pick the fruit while it is still shiny and firm.']
  ],
  Tomato: [
    ['Plough and harrow, then make raised beds so the roots never sit in water.'],
    ['Use a variety suited to the season, a heat-tolerant one for the warm months.', 'Raise seedlings for 3–4 weeks.'],
    ['Transplant 50 cm apart in rows 75–100 cm apart.', 'Stake or trellis the plants early.'],
    ['Water evenly: the fruit cracks when the soil swings between dry and wet.', 'Water at the base, in the morning, and mulch the beds.'],
    ['Apply complete fertilizer at planting and side-dress when the first fruits set.'],
    ['Weed until the plants cover the bed. Mulch keeps weeds down.'],
    ['Fruit worm and whitefly.', 'Leaf blight and wilt in wet weather. Remove sick plants and do not replant there.'],
    ['Harvest about 2–3 months after transplanting, when the fruit starts to colour.', 'Handle gently and keep the fruit in the shade.']
  ],
  Peanut: [
    ['Plough and harrow to a loose soil that drains well: the pods form underground.'],
    ['Use full, healthy seed of a recommended variety. Shell it just before planting.'],
    ['Sow 1–2 seeds every 15–20 cm in rows 50–60 cm apart, 4–5 cm deep.'],
    ['Handles dry weeks once it is up.', 'If it is very dry, water when it flowers and when the pegs go into the soil.'],
    ['Needs little nitrogen. Lime or gypsum helps the pods fill on acid soil.'],
    ['Weed and hill up before the pegs enter the soil, then leave it undisturbed.'],
    ['Leaf spot and rust on the leaves.', 'Cutworms and white grubs at the roots.'],
    ['Harvest at about 100 days, when the inside of most pods turns dark.', 'Dry the pods well before storing to keep mould away.']
  ],
  Sugarcane: [
    ['Plough deep and open furrows 1–1.5 m apart.'],
    ['Plant healthy cuttings with 3 buds each, from cane 8–10 months old.'],
    ['Lay the cuttings end to end in the furrow and cover them with a little soil.'],
    ['Deep roots carry it through short dry spells. Water in the first months and when it grows fastest.', 'Leaving the dry leaves on the ground keeps moisture in.'],
    ['Apply fertilizer at planting and again 2–3 months later.'],
    ['Weed in the first 3–4 months, until the cane closes over the rows.'],
    ['Stem borers and white grubs.', 'Smut: black whips at the tops. Pull out and burn the affected clumps.'],
    ['Harvest at 10–12 months, when the cane is mature and sweet.', 'Send it to the mill soon after cutting.']
  ],
  Cassava: [
    ['Plough and harrow. Ridges help on heavy soil.'],
    ['Use 20–25 cm stem cuttings from mature, healthy plants.'],
    ['Plant the cuttings upright or slanted, 1 m apart each way.'],
    ['Very hardy in a drought once rooted. Water only in the first weeks if it is very dry.'],
    ['Apply complete fertilizer at planting, most of all on poor soil.'],
    ['Weed in the first 3 months, until the leaves shade the ground.'],
    ['Mealybugs and mites in long dry spells.', 'Root rot in waterlogged soil.'],
    ['Harvest at 8–12 months.', 'Process or sell within 2 days: the roots spoil fast once dug.']
  ]
};

/* a crop's guide, when it has one */
export function guideOf(name: string): string[][] | undefined {
  return GD_CROP[GD_NAME[name] ?? name]
}
