import fs from 'fs';

let ac = fs.readFileSync('public/classic/cd4bef5efafb3ec7/account-client.js', 'utf8');

const oldAe = 'he.some(o=>o.id===a)?{rider:a,x:50,y:50,size:"cover",src:`/classic-assets/414a4427a4dcdcc4/assets/img/outfits/${a}-face.webp?v=3`}:null';

const newAe = 'he.some(o=>o.id===a)?{rider:a,x:50,y:50,size:"cover",src:`/classic-assets/414a4427a4dcdcc4/assets/img/chars/${a}-portrait-ai-v1.webp`}:null';

if (ac.includes(oldAe)) {
  ac = ac.replace(oldAe, newAe);
  fs.writeFileSync('public/classic/cd4bef5efafb3ec7/account-client.js', ac, 'utf8');
  console.log('✔ Updated account-client.js riderPortrait to use authentic -portrait-ai-v1.webp!');
} else {
  console.log('oldAe not found in account-client.js');
}
