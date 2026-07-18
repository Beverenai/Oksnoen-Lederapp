// Heuristic gender inference from Norwegian first names.
// Not perfect — used only for aggregate statistics.

const FEMALE = new Set<string>([
  'ada','agnes','aida','alice','alma','alva','amalie','amanda','amelia','amina','anna','anne','annika','ariel','astrid','aurora','ava',
  'bella','benedikte','birgit','birgitte','bjørg','camilla','caroline','cathrine','celina','cecilie','charlotte','chloe','clara',
  'daniela','ea','eda','eir','eira','eirin','elea','elena','eline','elisa','elisabeth','elise','ella','ellen','ellinor','elsa','emilie','emma','emmi','erika','erle','erna','ester','eva','evelyn',
  'fanny','felicia','filippa','frida','frøya','gerd','grete','gunhild','guro','hanna','hannah','hedda','hedvig','helene','helle','hennie','henny','hermine','hilde','hulda','ida','iben','idun','ilse','inga','ingeborg','inger','ingrid','ingvild','ines','iselin','isabella','isabelle','ivy',
  'jenny','jennifer','jesse','johanne','jomana','jorunn','josefine','josephine','judith','julia','julie','june',
  'kaja','kaisa','karen','kari','karin','karina','karoline','kasandra','kaisa','katarina','kate','katrine','kine','kira','kirsten','kirsti','kjersti','klara','klaudia','kornelia','kristine','kristina',
  'laila','lara','laura','leah','lea','lena','lene','leonora','leah','lilja','lilly','lily','lina','line','linda','linnea','lisa','lise','liv','lotte','louise','lova','lucia','luna','lydia',
  'madeleine','madelen','madicken','maiken','maja','malene','malin','margaret','margit','maria','marianne','marie','marion','marit','marte','martha','maren','marlene','maya','mette','mia','micaela','mila','milla','mille','miriam','mona','moa','my',
  'nadia','nanna','naomi','natalie','nathalie','nelli','nicoline','nikoline','nina','nora','norea','ofelia','oline','olivia','oline','ophelia',
  'paulina','petra','philippa','pia','ragna','ragnhild','randi','rebekka','regine','rikke','rita','ronja','rosa','runa','ruth','sanna','sara','sarah','saga','selma','signe','sigrid','sigrun','silje','simone','sinead','sissel','sofia','sofie','solveig','sonja','stella','stina','stine','sunniva','susanne','synne','synnøve',
  'talia','tanja','tea','tekla','tenna','terese','therese','thea','tilde','tina','tine','tiril','toril','tone','tonje','tordis','tora','tove','tuva','tyra',
  'ulrikke','una','unni','ursula','vanja','vera','veronica','victoria','vilde','viola','vivian','wenche','yara','yasmin','ylva','ylvi','yrja','ådne','åsa','åse',
]);

const MALE = new Set<string>([
  'aaron','abdi','abdirahman','abel','adam','adrian','ahmed','aksel','akseli','albert','aleksander','alex','alexander','alf','alfred','ali','allan','amir','anders','andreas','andré','andre','anton','arild','arne','aron','arthur','arvid','asbjørn','august','axel','ayaan',
  'benjamin','bendik','bent','bernt','birk','bjarne','bjørn','bo','bård','børge','brage','christer','christian','christoffer','cornelius','dag','daniel','david','david','david','david','david','dennis','didrik','dominic','dylan','edvard','edvin','egil','einar','eivind','elias','ellef','emanuel','emil','endre','erik','erlend','erling','espen','even',
  'fabian','felix','filip','finn','fillip','fillip','fillip','frank','fredrik','frode','gabriel','geir','georg','glenn','gunnar','gustav','hallvard','halvor','hans','harald','harry','hassan','haakon','håkon','hedin','heine','helge','henrik','herman','hjalmar','hugo','håvard','ibrahim','iben','iker','ingar','inge','ingvar','isak','ivan','ivar',
  'jack','jacob','jakob','jamal','jan','jarl','jarle','jasper','jens','jesper','jim','jimmy','joachim','joakim','joar','johan','johannes','john','jonas','jonathan','jon','jonatan','jonah','jorge','josef','josva','julian','jørgen','jørn',
  'kai','kalle','karl','kasper','kay','kenneth','kevin','kim','kjell','kjetil','klaus','knut','kolbjørn','konrad','kristian','kristoffer','kyrre','lars','lasse','leander','leif','lennart','leo','leon','levi','liam','linus','loke','ludvig','ludvik','lukas','lucas','lucian','lykke',
  'magne','magnus','malik','marcel','marco','marcus','markus','martin','marius','martinus','martinius','mats','matteo','matheo','matias','mathias','mattis','mehdi','mehmet','melvin','michael','mikael','mikal','mikkel','milan','mio','mo','mohammed','mohammad','morten','muhammad','nathanael','nikolai','nicolai','niels','nils','njål','noah','noel','norvald','odd','odin','ola','olai','olav','ole','oliver','olle','omar','oscar','oskar','otto',
  'paal','pål','patrick','paul','peder','per','peter','petter','philip','pontus','preben','ragnar','ragnvald','rasmus','reidar','remi','rikard','richard','robert','robin','roger','rolf','ronny','roy','rudolf','rune',
  'sander','samir','sam','samuel','sebastian','sigmund','sigurd','simen','simon','sindre','sivert','sondre','sten','stein','stian','stig','storm','sturla','svein','sverre','syver','ted','teo','theo','theodor','tarjei','tarald','terje','thom','thomas','thor','tim','timian','tobias','tollef','tom','tomas','tommy','tony','tor','tord','tore','torkel','torstein','trond','trym','truls','trygve','tyler','ulf','uno','uriah','vebjørn','vegard','viktor','vidar','vilhelm','viggo','viljar','vilmer','vincent','walter','warren','wilhelm','william','wilmer','ylvir','yngve','zakaria',
]);

export type Gender = 'female' | 'male' | 'unknown';

export function guessGender(firstOrFull: string | null | undefined): Gender {
  if (!firstOrFull) return 'unknown';
  const first = firstOrFull.trim().split(/\s+/)[0]?.toLowerCase();
  if (!first) return 'unknown';
  if (FEMALE.has(first)) return 'female';
  if (MALE.has(first)) return 'male';
  // Fallback: Norwegian female names very often end in a/e/i/y, males in specific consonants
  // Only use as weak hint — return unknown to avoid misclassification here.
  return 'unknown';
}