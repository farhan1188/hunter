#let resume(name: "", email: "", phone: "", location: "", links: (), summary: "", experiences: (), projects: (), skills: (:), education: ()) = [
  #set page(margin: 0.6in)
  #set text(font: "Inter", size: 10pt)
  #set par(justify: true)

  #align(center)[
    #text(weight: "bold", size: 18pt)[#name] \
    #email · #phone · #location \
    #links.join(" · ")
  ]

  #v(0.6em)
  #line(length: 100%, stroke: 0.4pt)
  #v(0.4em)

  #if summary != "" [
    *Summary.* #summary
    #v(0.4em)
  ]

  *Experience*
  #v(0.2em)
  #for e in experiences [
    *#e.title*, #e.company — #e.start–#e.end \
    #for b in e.bullets [
      - #b
    ]
    #v(0.2em)
  ]

  #if projects.len() > 0 [
    *Projects*
    #v(0.2em)
    #for p in projects [
      *#p.name* \
      #for b in p.bullets [
        - #b
      ]
      #v(0.2em)
    ]
  ]

  *Skills* \
  #skills.primary.join(", ") \
  #if skills.secondary.len() > 0 [
    _Also:_ #skills.secondary.join(", ")
  ]

  #if education.len() > 0 [
    #v(0.3em)
    *Education* \
    #for ed in education [
      #ed.degree, #ed.school (#ed.year) \
    ]
  ]
]
