// Player names BOXTER can say out loud (pre-rendered as n-<name>.mp3). Names not on the list
// still show in captions; the host just skips saying them. Common US first names across the
// last few decades, popular nicknames, family names and the test bots.
const NAMES = `
James John Robert Michael William David Richard Joseph Thomas Charles Christopher Daniel Matthew
Anthony Mark Donald Steven Paul Andrew Joshua Kenneth Kevin Brian George Timothy Ronald Edward
Jason Jeffrey Ryan Jacob Gary Nicholas Eric Jonathan Stephen Larry Justin Scott Brandon Benjamin
Samuel Gregory Alexander Frank Patrick Raymond Jack Dennis Jerry Tyler Aaron Jose Adam Nathan
Henry Douglas Zachary Peter Kyle Ethan Walter Noah Jeremy Christian Keith Roger Terry Gerald
Harold Sean Austin Carl Arthur Lawrence Dylan Jesse Jordan Bryan Billy Joe Bruce Gabriel Logan
Albert Willie Alan Juan Wayne Elijah Randy Roy Vincent Ralph Eugene Russell Bobby Mason Philip
Louis Liam Oliver Lucas Aiden Jackson Carter Owen Wyatt Luke Grayson Levi Isaac Lincoln Hudson
Jaxon Asher Leo Mateo Caleb Isaiah Hunter Eli Connor Landon Cameron Evan Adrian Nolan Colton Ian
Cooper Chase Blake Brody Miles Max Jake Luis Carlos Diego Miguel Antonio Alex Marcus Derek Travis
Shawn Chad Cody Corey Trevor Seth Spencer Garrett Dustin Brett Mitchell Victor Martin Jared Devin
Dominic Xavier Jayden Julian Ezra Theo Theodore Axel Silas Ryder Easton Declan Rowan Kai Finn
Jace Bentley Brayden Kayden Gavin Parker Josiah Micah Angel Jesus Emmanuel Omar Ali Mohammed
Ahmed Hassan Raj Arjun Rohan Wei Kenji Hiro Andre Darnell Malik Jamal Tyrone DeShawn Terrell
Kareem Tony Mike Matt Chris Dan Danny Dave Steve Tom Tommy Jim Jimmy Bob Bill Ben Sam Nick Nate
Josh Zach Will Jon Jeff Greg Rob Rich Rick Ricky Ed Eddie Ted Charlie Johnny Joey Pat Pete Ray
Ron Ken Kenny Andy Drew Gabe Jay Al Fred Hank Frankie Freddie Gus Ollie Harry Archie Teddy Benny
Manny Ozzy Rudy Sal Vinny Vince Tim Toby Wes Zeke Chuck Chip Buddy Mo Abe Ike Moe Leon Felix
Hugo Oscar Otto Rafael Ricardo Fernando Javier Alejandro Eduardo Pedro Sergio Marco Mario Enzo
Mary Patricia Jennifer Linda Elizabeth Barbara Susan Jessica Sarah Karen Lisa Nancy Betty Margaret
Sandra Ashley Kimberly Emily Donna Michelle Carol Amanda Dorothy Melissa Deborah Stephanie Rebecca
Sharon Laura Cynthia Kathleen Amy Angela Shirley Anna Brenda Pamela Emma Nicole Helen Samantha
Katherine Christine Debra Rachel Carolyn Janet Catherine Maria Heather Diane Ruth Julie Olivia
Joyce Virginia Victoria Kelly Lauren Christina Joan Evelyn Judith Megan Andrea Cheryl Hannah
Jacqueline Martha Gloria Teresa Ann Sara Madison Frances Kathryn Janice Jean Abigail Alice Judy
Sophia Grace Denise Amber Doris Marilyn Danielle Beverly Isabella Theresa Diana Natalie Brittany
Charlotte Marie Kayla Alexis Lori Ava Mia Harper Amelia Ella Chloe Aria Scarlett Zoe Lily Layla
Nora Riley Ellie Hazel Violet Aurora Stella Lucy Paisley Savannah Audrey Brooklyn Bella Claire
Skylar Leah Addison Aubrey Naomi Elena Gabriella Maya Valentina Ruby Ivy Sadie Piper Quinn Willow
Eva Madeline Kennedy Jasmine Morgan Taylor Paige Sydney Haley Allison Alyssa Destiny Jade Jenna
Kylie Mackenzie Molly Sierra Tiffany Vanessa Whitney Courtney Crystal Erica Erin Jamie Kristen
Lindsay Monica Tara Tina Wendy Yvonne Zara Priya Aisha Fatima Mei Yuki Keisha Tanisha Ebony
Latoya Rosa Carmen Lucia Sofia Camila Daniela Gabby Kate Katie Kat Liz Lizzie Beth Becky Jen Jenny
Jess Jessie Sammy Mandy Abby Allie Ally Annie Cathy Kathy Chrissy Debbie Deb Em Emmy Gina Jo Josie
Kim Kimmy Lexi Lulu Maddie Maggie Meg Nat Nikki Patty Peggy Polly Rosie Sally Sue Susie Tess Tori
Trish Vicky Bree Cece Dani Izzy Millie Nina Rita Sasha Tasha Bea Gigi Mimi Luna Iris Jane June
Rose Ada Cleo Elle Faith Hope Joy Kara Lana Lea Lola Mila Nova Remi Sky Tia
Mom Dad Mama Papa Mommy Daddy Nana Grandma Grandpa Granny Auntie Uncle Bro Sis Babe Boss
Captain Champ Chef Doc Coach Kiddo Ace Duke King Queen Player Host Guest Me You Bestie Buddy
`;

// Test bots (and other names whose spelling isn't how you'd say them).
const SPOKEN = {
  beepboop: 'Beep boop!',
  roborita: 'Robo Rita!',
  chadgpt: 'Chad G P T!',
  siriously: 'Siri-ously!',
  toaster: 'Toaster!',
  r2deuce: 'R2 Deuce!',
  byteme: 'Byte me!',
  clanky: 'Clanky!',
  deshawn: 'DeShawn!',
  jaxon: 'Jaxon!',
};

export function nameJobs(nameClip) {
  const jobs = new Map();
  for (const n of NAMES.split(/\s+/).filter(Boolean)) {
    const id = nameClip(n);
    if (id && !jobs.has(id)) jobs.set(id, n + '!');
  }
  for (const [k, text] of Object.entries(SPOKEN)) jobs.set('n-' + k, text);
  return [...jobs].map(([id, text]) => ({ id, text, kind: 'name' }));
}
