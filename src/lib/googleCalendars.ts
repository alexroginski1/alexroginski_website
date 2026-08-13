function cal(id: string) {
  return {
    id,
    add: `https://calendar.google.com/calendar/u/0/r?cid=${id}@group.calendar.google.com`,
  }
}

export const CALENDARS = {
  funCheap:         cal('60a19fdad14c75dc604082f022416e48c2d30dc440502a5e80bf410d32570d1d'),
  luma:             cal('45264416fab34dddf5fff1ca40931d59a13f865ec441d158030be512b30d6b15'),
  partiful:         cal('9d7c77c609ffc954909e2a0cb72e2c2b5029048fe87d0ba6a035ccac18e1472a'),
  sports:           cal('2a8d48b484e0b7d54bd801ad4849798902dbb347781ab1371b06f6cddaad9a9f'),
  other:            cal('c40ce35591588f6a8cf1d14e96f4ec215f2d812857382a0fb7253eabea1a0154'),
  arts_and_culture: cal('7f66e10ca74622780fdf0db852f0dc8e4be2272cf206bfc8cf83f2eaefc8abdf'),
  dancing:          cal('704367c0fe7ec0383a79ab3bd6a4388d8c867642120862ffa11191fdb27e407f'),
}
