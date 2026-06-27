const a='BQDw\nofp2G4MCvHKAlA0+IVe8m8gfPntmbvpud7uKwBLfzKarAWND0T1babPwmgyAjKzG\nBw1bOs7IwmoQzKIBdg3GrcIcXdwP54o19kTbzrU9gipcF7SMBIA+OiTQvYW3PpMR\npvkBln/JQCMBGKnWgz+Ie4Tu8sCFde8RPQrJuUp7jBAQCgBIAQCAFQBwGkqgNjBI';
const b='AAIY4IZAjsBdoJmHdX2ySqc1dpUkAC239BD0\nifUaaS/qx8ZxHrGx8b+C7OAMXRGhVNQTW+e47S3sIrWrOemZGK6jzTRv7VNcBneE\nWj9RtIxwosC8QallyGhyBqEquKbVy7LoA4ZUWjTAjMvzW0YOjM41SqOVUai/wvAI\n/NmlI3RIg2EAKCIM8AOAEA09ihkBAIIM';
let s = '';

for (let i = 0; i < a.length; i++)
{
  s += a[i];
  if (i < b.length)
  {
    s += b[i];    
  }
}
module.exports = s.split('').reverse()
  .join('');
