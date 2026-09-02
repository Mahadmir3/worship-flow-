// Seed the song library with a worship catalog (A–Z).
// - YouTube link per song (search link — always finds the song, never dead)
// - key / BPM / time signature / genre / theme tags
// - Full lyrics ONLY for public-domain hymns (pre-~1923). Modern song lyrics are
//   copyrighted (CCLI) — those get an empty lyrics box the church can fill.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const nid = () => "c" + randomBytes(12).toString("hex");
import { Pool } from "pg";

const env = readFileSync(".env.production.local", "utf8");
const url = env.match(/DATABASE_URL="([^"]+)"/)[1];
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });

const ORG_NAME = "admirable community church";
// [title, artist, key, bpm, timeSig, genre, tags, lyrics(PD only)]
const S = [
// ————— CLASSIC HYMNS (public domain — lyrics included) —————
["Amazing Grace","Traditional (John Newton)","G",90,"3/4","Hymn","grace, salvation, classic",
`Amazing grace, how sweet the sound
That saved a wretch like me
I once was lost, but now am found
Was blind, but now I see

'Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed

The Lord has promised good to me
His word my hope secures
He will my shield and portion be
As long as life endures

Yea, when this flesh and heart shall fail
And mortal life shall cease
I shall possess within the veil
A life of joy and peace

When we've been there ten thousand years
Bright shining as the sun
We've no less days to sing God's praise
Than when we'd first begun`],
["It Is Well With My Soul","Traditional (Horatio Spafford)","C",76,"4/4","Hymn","peace, trust, classic",
`When peace like a river attendeth my way
When sorrows like sea billows roll
Whatever my lot, Thou hast taught me to say
It is well, it is well with my soul

It is well (it is well) with my soul (with my soul)
It is well, it is well with my soul

Though Satan should buffet, though trials should come
Let this blessed assurance control
That Christ hath regarded my helpless estate
And hath shed His own blood for my soul

My sin, oh the bliss of this glorious thought
My sin, not in part but the whole
Is nailed to the cross, and I bear it no more
Praise the Lord, praise the Lord, O my soul

And Lord, haste the day when my faith shall be sight
The clouds be rolled back as a scroll
The trump shall resound, and the Lord shall descend
Even so, it is well with my soul`],
["Great Is Thy Faithfulness","Traditional (Thomas Chisholm)","Bb",84,"4/4","Hymn","faithfulness, morning, classic",
`Great is Thy faithfulness, O God my Father
There is no shadow of turning with Thee
Thou changest not, Thy compassions they fail not
As Thou hast been Thou forever wilt be

Great is Thy faithfulness, great is Thy faithfulness
Morning by morning new mercies I see
All I have needed Thy hand hath provided
Great is Thy faithfulness, Lord, unto me

Summer and winter and springtime and harvest
Sun, moon and stars in their courses above
Join with all nature in manifold witness
To Thy great faithfulness, mercy and love

Pardon for sin and a peace that endureth
Thine own dear presence to cheer and to guide
Strength for today and bright hope for tomorrow
Blessings all mine, with ten thousand beside`],
["Be Thou My Vision","Traditional (Irish, 8th c.)","D",88,"4/4","Hymn","devotion, classic",
`Be Thou my vision, O Lord of my heart
Naught be all else to me, save that Thou art
Thou my best thought by day or by night
Waking or sleeping, Thy presence my light

Be Thou my wisdom, and Thou my true word
I ever with Thee and Thou with me, Lord
Thou my great Father, and I Thy true son
Thou in me dwelling and I with Thee one

Riches I heed not, nor man's empty praise
Thou mine inheritance, now and always
Thou and Thou only first in my heart
High King of heaven, my treasure Thou art

High King of heaven, my victory won
May I reach heaven's joys, O bright heaven's sun
Heart of my own heart, whatever befall
Still be my vision, O Ruler of all`],
["Holy, Holy, Holy","Traditional (Reginald Heber)","D",84,"4/4","Hymn","holiness, trinity, classic",
`Holy, holy, holy! Lord God Almighty
Early in the morning our song shall rise to Thee
Holy, holy, holy! Merciful and mighty
God in three Persons, blessed Trinity

Holy, holy, holy! All the saints adore Thee
Casting down their golden crowns around the glassy sea
All the cherubim and seraphim are falling down before Thee
Which wert, and art, and evermore shalt be

Holy, holy, holy! Though the darkness hide Thee
Though the eye of sinful man Thy glory may not see
Only Thou art holy, there is none beside Thee
Perfect in power, in love and purity

Holy, holy, holy! Lord God Almighty
All Thy works shall praise Thy name in earth and sky and sea
Holy, holy, holy! Merciful and mighty
God in three Persons, blessed Trinity`],
["What a Friend We Have in Jesus","Traditional (Joseph Scriven)","D",80,"4/4","Hymn","friendship, prayer, classic",
`What a friend we have in Jesus
All our sins and griefs to bear
What a privilege to carry
Everything to God in prayer

Oh, what peace we often forfeit
Oh, what needless pain we bear
All because we do not carry
Everything to God in prayer

Have we trials and temptations?
Is there trouble anywhere?
We should never be discouraged
Take it to the Lord in prayer

Can we find a friend so faithful
Who will all our sorrows share?
Jesus knows our every weakness
Take it to the Lord in prayer`],
["Blessed Assurance","Traditional (Fanny Crosby)","F",88,"4/4","Hymn","assurance, classic",
`Blessed assurance, Jesus is mine
Oh, what a foretaste of glory divine
Heir of salvation, purchase of God
Born of His Spirit, washed in His blood

This is my story, this is my song
Praising my Savior all the day long
This is my story, this is my song
Praising my Savior all the day long

Perfect submission, perfect delight
Visions of rapture now burst on my sight
Angels descending bring from above
Echoes of mercy, whispers of love

Perfect submission, all is at rest
I in my Savior am happy and blessed
Watching and waiting, looking above
Filled with His goodness, lost in His love`],
["To God Be the Glory","Traditional (Fanny Crosby)","C",100,"4/4","Hymn","glory, testimony, classic",
`To God be the glory, great things He hath done
So loved He the world that He gave us His Son
Who yielded His life an atonement for sin
And opened the life gate that all may go in

Praise the Lord, praise the Lord
Let the earth hear His voice
Praise the Lord, praise the Lord
Let the people rejoice

Oh, come to the Father through Jesus the Son
And give Him the glory, great things He hath done

Oh, perfect redemption, the purchase of blood
To every believer the promise of God
The vilest offender who truly believes
That moment from Jesus a pardon receives

Great things He hath taught us, great things He hath done
And great our rejoicing through Jesus the Son
But purer and higher and greater will be
Our wonder, our transport, when Jesus we see`],
["I Surrender All","Traditional (Judson Van De Venter)","G",76,"4/4","Hymn","surrender, classic",
`All to Jesus I surrender
All to Him I freely give
I will ever love and trust Him
In His presence daily live

I surrender all, I surrender all
All to Thee, my blessed Savior
I surrender all

All to Jesus I surrender
Humbly at His feet I bow
Worldly pleasures all forsaken
Take me, Jesus, take me now

All to Jesus I surrender
Make me, Savior, wholly Thine
Let me feel the Holy Spirit
Truly know that Thou art mine`],
["When I Survey the Wondrous Cross","Traditional (Isaac Watts)","G",66,"4/4","Hymn","cross, easter, classic",
`When I survey the wondrous cross
On which the Prince of glory died
My richest gain I count but loss
And pour contempt on all my pride

Forbid it, Lord, that I should boast
Save in the death of Christ my God
All the vain things that charm me most
I sacrifice them to His blood

See from His head, His hands, His feet
Sorrow and love flow mingled down
Did e'er such love and sorrow meet
Or thorns compose so rich a crown

Were the whole realm of nature mine
That were a present far too small
Love so amazing, so divine
Demands my soul, my life, my all`],
["Come, Thou Fount of Every Blessing","Traditional (Robert Robinson)","D",84,"4/4","Hymn","gratitude, classic",
`Come, Thou fount of every blessing
Tune my heart to sing Thy grace
Streams of mercy never ceasing
Call for songs of loudest praise

Teach me some melodious sonnet
Sung by flaming tongues above
Praise the mount, I'm fixed upon it
Mount of Thy redeeming love

Here I raise my Ebenezer
Hither by Thy help I'm come
And I hope by Thy good pleasure
Safely to arrive at home

Jesus sought me when a stranger
Wandering from the fold of God
He to rescue me from danger
Interposed His precious blood

Oh, to grace how great a debtor
Daily I'm constrained to be
Let Thy goodness like a fetter
Bind my wandering heart to Thee

Prone to wander, Lord, I feel it
Prone to leave the God I love
Here's my heart, oh, take and seal it
Seal it for Thy courts above`],
["Just As I Am","Traditional (Charlotte Elliott)","G",72,"4/4","Hymn","invitation, classic",
`Just as I am, without one plea
But that Thy blood was shed for me
And that Thou bid'st me come to Thee
O Lamb of God, I come, I come

Just as I am, and waiting not
To rid my soul of one dark blot
To Thee whose blood can cleanse each spot
O Lamb of God, I come, I come

Just as I am, though tossed about
With many a conflict, many a doubt
Fightings and fears within, without
O Lamb of God, I come, I come

Just as I am, Thou wilt receive
Wilt welcome, pardon, cleanse, relieve
Because Thy promise I believe
O Lamb of God, I come, I come`],
["Rock of Ages","Traditional (Augustus Toplady)","G",72,"4/4","Hymn","refuge, classic",
`Rock of ages, cleft for me
Let me hide myself in Thee
Let the water and the blood
From Thy wounded side which flowed
Be of sin the double cure
Save from wrath and make me pure

Not the labors of my hands
Can fulfill Thy law's demands
Could my zeal no respite know
Could my tears forever flow
All for sin could not atone
Thou must save, and Thou alone

Nothing in my hand I bring
Simply to Thy cross I cling
Naked, come to Thee for dress
Helpless, look to Thee for grace
Foul, I to the fountain fly
Wash me, Savior, or I die

While I draw this fleeting breath
When mine eyes shall close in death
When I soar to worlds unknown
See Thee on Thy judgment throne
Rock of ages, cleft for me
Let me hide myself in Thee`],
["Softly and Tenderly","Traditional (Will Thompson)","G",64,"4/4","Hymn","invitation, classic",
`Softly and tenderly Jesus is calling
Calling for you and for me
See, on the portals He's waiting and watching
Watching for you and for me

Come home, come home
Ye who are weary, come home
Earnestly, tenderly, Jesus is calling
Calling, O sinner, come home

Why should we tarry when Jesus is pleading
Pleading for you and for me
Why should we linger and heed not His mercies
Mercies for you and for me

Time is now fleeting, the moments are passing
Passing from you and from me
Shadows are gathering, death beds are coming
Coming for you and for me`],
["Tis So Sweet to Trust in Jesus","Traditional (Louisa Stead)","D",84,"4/4","Hymn","trust, classic",
`'Tis so sweet to trust in Jesus
Just to take Him at His word
Just to rest upon His promise
Just to know, Thus saith the Lord

Jesus, Jesus, how I trust Him
How I've proved Him o'er and o'er
Jesus, Jesus, precious Jesus
Oh, for grace to trust Him more

I'm so glad I learned to trust Thee
Precious Jesus, Savior, Friend
And I know that Thou art with me
Wilt be with me to the end`],
["Jesus Loves Me","Traditional (Anna Warner)","C",92,"4/4","Hymn","children, love, classic",
`Jesus loves me, this I know
For the Bible tells me so
Little ones to Him belong
They are weak but He is strong

Yes, Jesus loves me
Yes, Jesus loves me
Yes, Jesus loves me
The Bible tells me so

Jesus loves me, He who died
Heaven's gates to open wide
He will wash away my sin
Let His little child come in

Jesus loves me, loves me still
Though I'm very weak and ill
From His shining throne on high
Comes to watch me where I lie`],
["Turn Your Eyes Upon Jesus","Traditional (Helen Lemmel)","C",70,"3/4","Hymn","focus, peace, classic",
`O soul, are you weary and troubled?
No light in the darkness you see?
There's light for a look at the Savior
And life more abundant and free

Turn your eyes upon Jesus
Look full in His wonderful face
And the things of earth will grow strangely dim
In the light of His glory and grace

Through death into life everlasting
He passed, and we follow Him there
Over us sin no more hath dominion
For more than conquerors we are

His word shall not fail you, He promised
Believe Him and all will be well
Then go to a world that is dying
His perfect salvation to tell`],
["Doxology (Praise God From Whom All Blessings Flow)","Traditional (Thomas Ken)","G",100,"4/4","Hymn","doxology, classic",
`Praise God from whom all blessings flow
Praise Him all creatures here below
Praise Him above ye heavenly host
Praise Father, Son and Holy Ghost

Amen`],
["How Great Thou Art","Traditional (Carl Boberg / Stuart Hine)","Bb",72,"4/4","Hymn","majesty, classic",null],
["Victory in Jesus","Eugene M. Bartlett","G",104,"4/4","Gospel","victory, testimony",null],
["I Need Thee Every Hour","Traditional (Annie Hawks)","G",72,"4/4","Hymn","dependence",null],
["Standing on the Promises","Traditional (Russell Kelso Carter)","A",120,"4/4","Hymn","promises, faith",null],
["Leaning on the Everlasting Arms","Traditional (Elisha Hoffman)","G",104,"4/4","Hymn","trust, joy",null],
["Sweet Hour of Prayer","Traditional (William Walford)","D",72,"4/4","Hymn","prayer",null],
["Nearer, My God, to Thee","Traditional (Sarah Adams)","C",76,"4/4","Hymn","devotion",null],
["Fairest Lord Jesus","Traditional (Münster Gesangbuch)","F",80,"3/4","Hymn","beauty of Christ",null],
["All Creatures of Our God and King","Traditional (St. Francis of Assisi)","D",96,"4/4","Hymn","creation, praise",null],
["Praise to the Lord, the Almighty","Traditional (Joachim Neander)","A",104,"4/4","Hymn","praise",null],
["A Mighty Fortress Is Our God","Traditional (Martin Luther)","C",96,"4/4","Hymn","strength, reformation",null],
["At the Cross (Alas! and Did My Savior Bleed)","Traditional (Isaac Watts)","E",72,"4/4","Hymn","cross",null],
["Are You Washed in the Blood?","Traditional (Elisha Hoffman)","A",120,"4/4","Gospel","cleansing",null],
["Nothing but the Blood","Traditional (Robert Lowry)","A",96,"4/4","Hymn","cleansing",null],
["There Is Power in the Blood","Traditional (Lewis Jones)","A",120,"4/4","Gospel","power, cleansing",null],
["There Is a Fountain","Traditional (William Cowper)","E",80,"3/4","Hymn","cleansing",null],
["When We All Get to Heaven","Traditional (Eliza Hewitt)","G",132,"4/4","Hymn","heaven, hope",null],
["This Is My Father's World","Traditional (Maltbie Babcock)","F",88,"4/4","Hymn","creation",null],
["For the Beauty of the Earth","Traditional (Folliott Pierpoint)","F",96,"4/4","Hymn","thanksgiving",null],
["How Firm a Foundation","Traditional (attrib. John Rippon)","D",88,"4/4","Hymn","foundation, word",null],
["Have Thine Own Way, Lord","Traditional (Adelaide Pollard)","D",72,"4/4","Hymn","surrender",null],
["He Leadeth Me","Traditional (Joseph Gilmore)","C",84,"4/4","Hymn","guidance",null],
["Count Your Blessings","Traditional (Johnson Oatman Jr.)","C",104,"4/4","Hymn","thanksgiving",null],
["My Jesus, I Love Thee","Traditional (William Featherstone)","D",84,"4/4","Hymn","love",null],
["Wonderful Grace of Jesus","Traditional (Haldor Lillenas)","G",120,"4/4","Hymn","grace",null],
["In the Garden","Traditional (C. Austin Miles)","G",84,"4/4","Hymn","fellowship",null],
["And Can It Be","Traditional (Charles Wesley)","D",104,"4/4","Hymn","wonder, salvation",null],
["Be Still, My Soul","Traditional (Katharina von Schlegel)","G",72,"4/4","Hymn","peace",null],
["Crown Him with Many Crowns","Traditional (Matthew Bridges)","D",96,"4/4","Hymn","kingship",null],
["Come, Thou Long-Expected Jesus","Traditional (Charles Wesley)","G",92,"4/4","Hymn","advent",null],

// ————— MODERN WORSHIP —————
["What A Beautiful Name","Hillsong Worship","D",68,"4/4","Modern Worship","glory, wonder"],
["Who You Say I Am","Hillsong Worship","G",72,"4/4","Modern Worship","identity, freedom"],
["Oceans (Where Feet May Fail)","Hillsong UNITED","D",75,"4/4","Modern Worship","faith, spirit"],
["Shout to the Lord","Darlene Zschech","A",68,"4/4","Modern Worship","praise, classic"],
["Mighty to Save","Hillsong Worship","D",76,"4/4","Modern Worship","salvation"],
["Cornerstone","Hillsong Worship","E",76,"4/4","Modern Worship","foundation"],
["King of Kings","Hillsong Worship","G",70,"4/4","Modern Worship","gospel story"],
["New Wine","Hillsong Worship","D",68,"4/4","Modern Worship","spirit, surrender"],
["Broken Vessels (Amazing Grace)","Hillsong Worship","G",76,"4/4","Modern Worship","grace"],
["Worthy Is the Lamb","Hillsong Worship","G",72,"4/4","Modern Worship","worship, cross"],
["All Things Are Possible","Hillsong Worship","D",132,"4/4","Modern Worship","faith"],
["Touching Heaven, Changing Earth","Hillsong Worship","G",140,"4/4","Modern Worship","prayer"],
["Jesus, What a Beautiful Name","Hillsong Worship","D",68,"4/4","Modern Worship","name of jesus"],
["Hosanna","Hillsong Worship (Brooke Ligertwood)","A",72,"4/4","Modern Worship","hosanna"],
["Lead Me to the Cross","Brooke Ligertwood","G",76,"4/4","Modern Worship","surrender"],
["None but Jesus","Hillsong Worship","G",70,"4/4","Modern Worship","devotion"],
["Desert Song","Hillsong Worship","D",132,"4/4","Modern Worship","perseverance"],
["From the Inside Out","Hillsong UNITED","E",76,"4/4","Modern Worship","transformation"],
["The Stand","Hillsong UNITED","E",76,"4/4","Modern Worship","surrender"],
["Salvation Is Here","Hillsong UNITED","E",132,"4/4","Modern Worship","salvation"],
["One Way","Hillsong UNITED","E",140,"4/4","Modern Worship","jesus"],
["10,000 Reasons (Bless the Lord)","Matt Redman","G",76,"4/4","Modern Worship","thanksgiving"],
["Blessed Be Your Name","Matt Redman","G",132,"4/4","Modern Worship","praise"],
["The Heart of Worship","Matt Redman","G",80,"4/4","Modern Worship","worship"],
["Better Is One Day","Matt Redman","D",104,"4/4","Modern Worship","presence"],
["You Never Let Go","Matt Redman","G",88,"4/4","Modern Worship","faithfulness"],
["How Great Is Our God","Chris Tomlin","A",72,"4/4","Modern Worship","majesty"],
["Forever (We Sing Hallelujah)","Chris Tomlin","C",76,"4/4","Modern Worship","resurrection"],
["Amazing Grace (My Chains Are Gone)","Chris Tomlin","G",72,"4/4","Modern Worship","grace"],
["Good Good Father","Chris Tomlin","G",68,"4/4","Modern Worship","father, love"],
["Holy Is the Lord","Chris Tomlin","G",132,"4/4","Modern Worship","holiness"],
["We Fall Down","Chris Tomlin","G",80,"4/4","Modern Worship","humility"],
["Enough","Chris Tomlin","G",88,"4/4","Modern Worship","sufficiency"],
["Indescribable","Chris Tomlin","G",72,"4/4","Modern Worship","creation"],
["Unchanging","Chris Tomlin","D",88,"4/4","Modern Worship","faithfulness"],
["Holy Forever","Chris Tomlin","E",76,"4/4","Modern Worship","eternity"],
["You Are My King (Amazing Love)","Chris Tomlin","G",88,"4/4","Modern Worship","cross, love"],
["How He Loves","David Crowder / John Mark McMillan","D",72,"4/4","Modern Worship","love"],
["Open the Eyes of My Heart","Paul Baloche","E",132,"4/4","Modern Worship","worship"],
["Above All","Paul Baloche","G",72,"4/4","Modern Worship","cross"],
["Hosanna (Praise Is Rising)","Paul Baloche","G",88,"4/4","Modern Worship","praise"],
["Your Name","Paul Baloche","E",88,"4/4","Modern Worship","name of jesus"],
["Ancient of Days","Ron Kenoly (Jamie Harvill)","C",104,"4/4","Modern Worship","victory"],
["I Could Sing of Your Love Forever","Delirious?","E",104,"4/4","Modern Worship","love"],
["Did You Feel the Mountains Tremble","Delirious?","D",116,"4/4","Modern Worship","revival"],
["History Maker","Delirious?","A",132,"4/4","Modern Worship","calling"],
["Majesty (Here I Am)","Delirious?","E",80,"4/4","Modern Worship","majesty"],
["Lord, You Have My Heart","Delirious?","D",84,"4/4","Modern Worship","devotion"],
["As the Deer","Martin Nystrom","G",84,"4/4","Modern Worship","longing"],
["Give Thanks","Henry Smith","D",84,"4/4","Modern Worship","thanksgiving"],
["Draw Me Close","Vineyard Worship","G",80,"4/4","Modern Worship","intimacy"],
["Breathe","Marie Barnett","D",72,"4/4","Modern Worship","spirit"],
["There Is a Redeemer","Melody Green","G",88,"4/4","Modern Worship","redeemer"],
["Seek Ye First","Karen Lafferty","D",100,"4/4","Modern Worship","word"],
["Jesus, Name Above All Names","Naida Hearn","C",72,"4/4","Modern Worship","name of jesus"],
["More Precious Than Silver","Lynn DeShazo","D",76,"4/4","Modern Worship","worth"],
["I Stand in Awe","Mark Altrogge","G",76,"4/4","Modern Worship","holiness"],
["I Exalt Thee","Pete Sanchez Jr.","C",80,"4/4","Modern Worship","exaltation"],
["Father, I Adore You","Terrye Coelho","G",88,"3/4","Modern Worship","devotion"],
["I Love You, Lord","Linda Krajjard","F",72,"4/4","Modern Worship","devotion"],
["In Christ Alone","Keith & Kristyn Getty","D",80,"4/4","Modern Worship","gospel story"],
["The Power of the Cross (Oh, to See the Dawn)","Keith & Kristyn Getty","E",72,"4/4","Modern Worship","cross"],
["Speak, O Lord","Keith & Kristyn Getty","G",72,"4/4","Modern Worship","word"],
["Thy Word","Amy Grant (Michael W. Smith)","F",88,"4/4","Modern Worship","word"],
["El Shaddai","Michael Card","E",84,"4/4","Modern Worship","names of god"],
["Agnus Dei","Michael W. Smith","E",68,"4/4","Modern Worship","holiness"],
["Awesome God","Rich Mullins","E",120,"4/4","Modern Worship","awe"],
["Step by Step (Sometimes by Step)","Rich Mullins","D",88,"4/4","Modern Worship","devotion"],
["Great Is the Lord","Michael W. Smith","C",88,"4/4","Modern Worship","praise"],
["Shine, Jesus, Shine","Graham Kendrick","D",104,"4/4","Modern Worship","revival"],
["The Power of Your Love","Geoff Bullock","D",72,"4/4","Modern Worship","love"],
["You're Worthy of My Praise","David Ruis","D",104,"4/4","Modern Worship","worth"],
["He Knows My Name","Tommy Walker","D",84,"4/4","Modern Worship","identity"],
["Refiner's Fire (Purify My Heart)","Brian Doerksen","D",80,"4/4","Modern Worship","holiness"],
["Come, Now Is the Time to Worship","Brian Doerksen","D",100,"4/4","Modern Worship","invitation"],
["Faithful One","Brian Doerksen","G",84,"4/4","Modern Worship","faithfulness"],
["I Lift My Eyes Up","Brian Doerksen","G",76,"4/4","Modern Worship","trust"],
["This Is Amazing Grace","Phil Wickham","B",104,"4/4","Modern Worship","grace"],
["Living Hope","Phil Wickham","E",76,"4/4","Modern Worship","resurrection"],
["Battle Belongs","Phil Wickham","C",76,"4/4","Modern Worship","warfare"],
["House of the Lord","Phil Wickham","D",104,"4/4","Modern Worship","joy"],
["You Are Holy (Prince of Peace)","Michael W. Smith","A",132,"4/4","Modern Worship","holiness"],
["God of Wonders","Marc Byrd / Steve Hindalong","G",76,"4/4","Modern Worship","creation"],
["Lord, I Need You","Matt Maher","F",72,"4/4","Modern Worship","dependence"],
["Your Grace Is Enough","Matt Maher","G",104,"4/4","Modern Worship","grace"],
["Because He Lives (Amen)","Matt Maher / Chris Tomlin","A",88,"4/4","Modern Worship","resurrection"],
["Goodness of God","Bethel Music (Jenn Johnson)","C",72,"4/4","Modern Worship","goodness"],
["Raise a Hallelujah","Bethel Music","F",76,"4/4","Modern Worship","praise, warfare"],
["No Longer Slaves","Bethel Music","F",76,"4/4","Modern Worship","freedom, identity"],
["The Lion and the Lamb","Bethel Music / Leeland","C",76,"4/4","Modern Worship","victory"],
["We Will Not Be Shaken","Bethel Music","G",88,"4/4","Modern Worship","steadfastness"],
["One Thing Remains","Bethel Music / Jesus Culture","G",76,"4/4","Modern Worship","love"],
["Forever","Kari Jobe","G",76,"4/4","Modern Worship","resurrection"],
["Revelation Song","Kari Jobe (Jennie Riddle)","D",72,"4/4","Modern Worship","holiness"],
["The Garden","Kari Jobe","A",72,"4/4","Modern Worship","restoration"],
["No Sweeter Name","Kari Jobe","G",76,"4/4","Modern Worship","name of jesus"],
["You Say","Lauren Daigle","Ab",68,"4/4","Modern Worship","identity"],
["How Can It Be","Lauren Daigle","C",76,"4/4","Modern Worship","grace"],
["Trust in You","Lauren Daigle","C",76,"4/4","Modern Worship","trust"],
["Rescue","Lauren Daigle","C",72,"4/4","Modern Worship","rescue"],
["Thank God I Do","Lauren Daigle","G",72,"4/4","Modern Worship","gratitude"],
["Chain Breaker","Zach Williams","G",88,"4/4","Modern Worship","freedom"],
["Fear Is a Liar","Zach Williams","E",76,"4/4","Modern Worship","fear, truth"],
["There Was Jesus","Zach Williams ft. Dolly Parton","D",72,"4/4","Modern Worship","presence"],
["Resurrection Day","Zach Williams","A",104,"4/4","Modern Worship","resurrection"],
["Reckless Love","Cory Asbury","D",76,"4/4","Modern Worship","love"],
["The Father's House","Cory Asbury","G",88,"4/4","Modern Worship","belonging"],
["Sparrows","Cory Asbury","G",84,"4/4","Modern Worship","worth"],
["Gratitude","Brandon Lake","C",72,"4/4","Modern Worship","thanksgiving"],
["Honey in the Rock","Brandon Lake","D",88,"4/4","Modern Worship","blessing"],
["Too Good to Not Believe","Brandon Lake","B",76,"4/4","Modern Worship","faith"],
["Graves Into Gardens","Elevation Worship ft. Brandon Lake","G",76,"4/4","Modern Worship","transformation"],
["The Blessing","Elevation Worship / Kari Jobe / Cody Carnes","D",72,"4/4","Modern Worship","blessing"],
["O Come to the Altar","Elevation Worship","A",76,"4/4","Modern Worship","invitation"],
["Do It Again","Elevation Worship","C",88,"4/4","Modern Worship","faithfulness"],
["Rattle!","Elevation Worship","F",140,"4/4","Modern Worship","resurrection"],
["The Anthem","Elevation Worship","C",76,"4/4","Modern Worship","victory"],
["See a Victory","Elevation Worship","G",76,"4/4","Modern Worship","victory"],
["Jireh","Elevation Worship / Maverick City","Db",72,"4/4","Modern Worship","provision"],
["Same God","Elevation Worship","D",76,"4/4","Modern Worship","faithfulness"],
["Million Little Miracles","Elevation Worship","G",76,"4/4","Modern Worship","testimony"],
["Promises","Maverick City Music","Db",72,"4/4","Modern Worship","promises"],
["Refiner","Maverick City Music","E",72,"4/4","Modern Worship","holiness"],
["Champion","Maverick City Music (Dante Bowe)","G",88,"4/4","Modern Worship","victory"],
["Joy of the Lord","Maverick City Music (Dante Bowe)","F",104,"4/4","Modern Worship","joy"],
["Wait on You","Maverick City Music","Ab",72,"4/4","Modern Worship","patience"],
["Nothing Else","Cody Carnes","A",72,"4/4","Modern Worship","presence"],
["Christ Be Magnified","Cody Carnes","G",76,"4/4","Modern Worship","exaltation"],
["Build My Life","Housefires (Pat Barrett)","C",76,"4/4","Modern Worship","foundation"],
["Good Good Father (Housefires)","Housefires","G",68,"4/4","Modern Worship","father"],
["Yes and Amen","Housefires (Chris Brown)","G",76,"4/4","Modern Worship","promises"],
["Great Are You Lord","All Sons & Daughters","B",76,"4/4","Modern Worship","breath"],
["Yet Not I But Through Christ in Me","CityAlight","F",76,"4/4","Modern Worship","gospel"],
["Christ Is Mine Forevermore","CityAlight","D",76,"4/4","Modern Worship","hope"],
["Only a Holy God","CityAlight","C",76,"4/4","Modern Worship","holiness"],
["Jesus, Precious Jesus","CityAlight","G",72,"4/4","Modern Worship","worth"],
["Build Your Kingdom Here","Rend Collective","D",132,"4/4","Modern Worship","kingdom"],
["My Lighthouse","Rend Collective","G",104,"4/4","Modern Worship","guidance"],
["Counting Every Blessing","Rend Collective","C",104,"4/4","Modern Worship","gratitude"],
["Bold I Approach (The Mystery)","Rend Collective","A",104,"4/4","Modern Worship","access"],
["Holy Water","We the Kingdom","G",88,"4/4","Modern Worship","grace"],
["God So Loved","We the Kingdom","G",76,"4/4","Modern Worship","love"],
["Glorious Day (Living He Loved Me)","Passion (Kristian Stanfill)","G",88,"4/4","Modern Worship","gospel"],
["Worthy of Your Name","Passion","G",88,"4/4","Modern Worship","worth"],
["Take Me Deeper","Vineyard Worship","G",104,"4/4","Modern Worship","spirit"],
["Spirit of the Living God","Vertical Worship","G",76,"4/4","Modern Worship","spirit"],
["Praise You in This Storm","Casting Crowns","G",76,"4/4","Modern Worship","suffering, faith"],
["Who Am I","Casting Crowns","G",76,"4/4","Modern Worship","identity"],
["Voice of Truth","Casting Crowns","D",76,"4/4","Modern Worship","faith, fear"],
["I Can Only Imagine","MercyMe","E",76,"4/4","Modern Worship","heaven"],
["Word of God Speak","MercyMe","G",72,"4/4","Modern Worship","word"],
["Even If","MercyMe","D",76,"4/4","Modern Worship","trust"],
["I Still Believe","Jeremy Camp","G",88,"4/4","Modern Worship","perseverance"],
["Walk by Faith","Jeremy Camp","D",88,"4/4","Modern Worship","faith"],
["Though You Slay Me","Shane & Shane","E",76,"4/4","Modern Worship","suffering"],
["Speak (Lord Your Servant Is Listening)","Kim Walker-Smith","G",88,"4/4","Modern Worship","word"],
["Awake My Soul (Sing Hallelujah)","Hillsong Worship","A",76,"4/4","Modern Worship","awakening"],
["Man of Sorrows","Hillsong Worship","E",76,"4/4","Modern Worship","cross"],
["At the Cross (Love Ran Red)","Chris Tomlin","D",76,"4/4","Modern Worship","cross"],
["Whom Shall I Fear (God of Angel Armies)","Chris Tomlin","G",88,"4/4","Modern Worship","fear, protection"],
["Jesus Messiah","Chris Tomlin","G",76,"4/4","Modern Worship","gospel"],
["Resurrection Power","Chris Tomlin","G",104,"4/4","Modern Worship","resurrection"],
["Is He Worthy","Chris Tomlin (Andrew Peterson)","G",76,"6/8","Modern Worship","worth"],
["Living He Loved Me","Stuart Townend","G",88,"4/4","Modern Worship","gospel"],

// ————— GOSPEL / CHOIR —————
["Total Praise","Richard Smallwood","Eb",72,"4/4","Gospel","surrender, choir"],
["Never Would Have Made It","Marvin Sapp","Db",72,"4/4","Gospel","testimony"],
["Every Praise","Hezekiah Walker","C",104,"4/4","Gospel","praise"],
["Break Every Chain","Tasha Cobbs Leonard","G",76,"4/4","Gospel","freedom"],
["You Know My Name","Tasha Cobbs Leonard","Ab",72,"4/4","Gospel","identity"],
["Made a Way","Travis Greene","Ab",72,"4/4","Gospel","testimony"],
["Intentional","Travis Greene","F",104,"4/4","Gospel","purpose"],
["You Waited","Travis Greene","Ab",72,"4/4","Gospel","patience"],
["My Tribute (To God Be the Glory)","Andraé Crouch","C",72,"4/4","Gospel","gratitude"],
["Through It All","Andraé Crouch","C",72,"4/4","Gospel","testimony"],
["Soon and Very Soon","Andraé Crouch","C",104,"4/4","Gospel","heaven"],
["The Blood Will Never Lose Its Power","Andraé Crouch","C",72,"4/4","Gospel","cleansing"],
["My Life Is in Your Hands","Kirk Franklin","F",88,"4/4","Gospel","trust"],
["Love Theory","Kirk Franklin","G",104,"4/4","Gospel","love"],
["Hosanna (Kirk Franklin)","Kirk Franklin","F",88,"4/4","Gospel","praise"],
["I Give Myself Away","William McDowell","Ab",72,"4/4","Gospel","surrender"],
["I Won't Go Back","William McDowell","Bb",76,"4/4","Gospel","commitment"],
["No Weapon","Fred Hammond","F",104,"4/4","Gospel","warfare"],
["Smile","Kirk Franklin","Ab",88,"4/4","Gospel","joy"],
["Optimistic","Sounds of Blackness","F",104,"4/4","Gospel","hope"],

// ————— AFRICAN WORSHIP —————
["Way Maker","Sinach","B",72,"4/4","African Worship","miracles, presence"],
["I Know Who I Am","Sinach","E",132,"4/4","African Worship","identity"],
["Great Are You Lord (Sinach)","Sinach","D",76,"4/4","African Worship","praise"],
["Onise Iyanu (God of Awesome Wonders)","Nathaniel Bassey","D",76,"4/4","African Worship","wonders"],
["Imela (Thank You)","Nathaniel Bassey ft. Enitan Adaba","C",72,"4/4","African Worship","gratitude"],
["Hallelujah Eh","Nathaniel Bassey","G",88,"4/4","African Worship","praise"],
["Jesus Iye (Jesus Thank You)","Nathaniel Bassey","D",76,"4/4","African Worship","gratitude"],
["Mighty God (Eben & Joe Praize)","Joe Praize","E",104,"4/4","African Worship","might"],
["Most High","Joe Praize","D",88,"4/4","African Worship","holiness"],
["You Too Dey Bless Me","Frank Edwards","C",104,"4/4","African Worship","blessing"],
["Under the Canopy","Frank Edwards","D",104,"4/4","African Worship","presence"],
["Victory","Eben","G",132,"4/4","African Worship","victory"],
["Excess Love","Mercy Chinwo","D",76,"4/4","African Worship","love"],
["Chinedum (He Leads Me)","Mercy Chinwo","C",104,"4/4","African Worship","guidance"],
["Obinasomo","Mercy Chinwo","D",104,"4/4","African Worship","praise"],
["Only You Jesus","Ada Ehi","D",104,"4/4","African Worship","devotion"],
["Bobo Me","Ada Ehi","C",104,"4/4","African Worship","love"],
["I Testify","Ada Ehi","D",88,"4/4","African Worship","testimony"],
["Open Up","Dunsin Oyekan","E",76,"4/4","African Worship","spirit"],
["Absolutely","Dunsin Oyekan","D",104,"4/4","African Worship","praise"],
["Fire Fall","Victoria Orenze","E",88,"4/4","African Worship","fire, spirit"],
["Apostolic Sound (Thanks Be to God)","Victoria Orenze","G",104,"4/4","African Worship","praise"],
["All That Matters","GUC","C",76,"4/4","African Worship","surrender"],
["For My Good","Preye Odede","Ab",76,"4/4","African Worship","testimony"],
["E No Dey Fall Hand","Proclaim?","G",104,"4/4","African Worship","faithfulness"],
["God Will Make a Way","Don Moen","G",88,"4/4","African Worship","guidance"],
["I Want to Be Where You Are","Don Moen","D",88,"4/4","African Worship","presence"],
["Thank You Lord (Don Moen)","Don Moen","G",88,"4/4","African Worship","gratitude"],
["Lift Him Up","Ron Kenoly","C",132,"4/4","African Worship","praise"],
["Jesus Is Alive","Ron Kenoly","D",120,"4/4","African Worship","resurrection"],
["He Is Lovely","Bob Fitts","G",88,"4/4","African Worship","devotion"],
["Amazing Love (Lionel Peterson)","Lionel Peterson","G",76,"4/4","African Worship","love"],
["Uwezo (Ability)","Christina Shusho","Ab",104,"4/4","African Worship","power"],
["Nenda Lote (Go All the Way)","Christina Shusho","F",104,"4/4","African Worship","calling"],
["Ni Wewe Tu (It Is Only You)","Goodluck Gozbert","G",88,"4/4","African Worship","devotion"],
["Turn the Replay","Levixone","G",104,"4/4","African Worship","testimony"],
["Mukama Mulungi (God Is Good)","Coopy Bly","D",104,"4/4","African Worship","goodness"],
["Nsamira (I Will Dance)","Wilson Bugembe","D",104,"4/4","African Worship","joy"],
["Yessu Beera Nange (Jesus Be With Me)","Judith Babirye","G",88,"4/4","African Worship","presence"],
["Ekiba Bwekiba (Whatever Happens)","Judith Babirye","D",88,"4/4","African Worship","trust"],
["Bwana Yesu Asifiwe (Praise the Lord Jesus)","Swahili Traditional","G",104,"4/4","African Worship","praise"],
["Sifa Zetu (Our Praise)","Swahili Traditional","D",104,"4/4","African Worship","praise"],
["Yesu Wangu Nakupenda (My Jesus I Love You)","Swahili Traditional","G",88,"4/4","African Worship","love"],

// ————— CHRISTMAS —————
["O Come, All Ye Faithful","Traditional (John Wade)","G",100,"4/4","Christmas","adoration"],
["Silent Night","Traditional (Franz Gruber)","C",72,"3/4","Christmas","holy night"],
["Joy to the World","Traditional (Isaac Watts / Lowell Mason)","D",112,"4/4","Christmas","joy"],
["Hark! The Herald Angels Sing","Traditional (Charles Wesley)","G",112,"4/4","Christmas","angels"],
["O Holy Night","Traditional (Adolphe Adam)","C",64,"3/4","Christmas","holy night"],
["Angels We Have Heard on High","Traditional","G",112,"4/4","Christmas","angels"],
["The First Noel","Traditional","D",88,"3/4","Christmas","nativity"],
["What Child Is This","Traditional","Em",88,"3/4","Christmas","nativity"],
["Away in a Manger","Traditional","C",88,"3/4","Christmas","nativity"],
["O Come, O Come, Emmanuel","Traditional","Em",76,"4/4","Christmas","advent"],
["Go Tell It on the Mountain","Traditional (John W. Work)","G",120,"4/4","Christmas","testimony"],
["Angels From the Realms of Glory","Traditional","G",104,"4/4","Christmas","angels"],
];

const org = await pool.query('SELECT id FROM "Organization" WHERE name = $1', [ORG_NAME]);
if (!org.rows.length) throw new Error("org not found");
const oid = org.rows[0].id;

const existing = await pool.query("SELECT lower(title) AS t, lower(coalesce(artist,'')) AS a FROM \"Song\" WHERE \"organizationId\"=$1", [oid]);
const have = new Set(existing.rows.map((r) => r.t + "|" + r.a));

let inserted = 0, skipped = 0;
for (const [title, artist, key, bpm, ts, genre, tags, lyrics] of S) {
  const k = title.toLowerCase() + "|" + artist.toLowerCase();
  if (have.has(k)) { skipped++; continue; }
  have.add(k);
  const yt = "https://www.youtube.com/results?search_query=" + encodeURIComponent(`${artist} ${title} worship`);
  const r = await pool.query(
    `INSERT INTO "Song" (id, "organizationId", title, artist, "defaultKey", bpm, "timeSignature", genre, tags, "youtubeUrl", notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [nid(), oid, title, artist, key, bpm, ts, genre, tags, yt,
     lyrics ? "Lyrics included (public domain hymn)." : "Tip: paste lyrics from your CCLI SongSelect or the official lyric video."]
  );
  if (lyrics) {
    await pool.query(
      `INSERT INTO "Arrangement" (id, "songId", name, key, bpm, lyrics) VALUES ($1,$2,'Standard',$3,$4,$5)`,
      [nid(), r.rows[0].id, key, bpm, lyrics]
    );
  }
  inserted++;
}
const total = await pool.query('SELECT count(*)::int c FROM "Song" WHERE "organizationId"=$1', [oid]);
console.log(`inserted: ${inserted}, skipped (already there): ${skipped}, library now: ${total.rows[0].c} songs`);
await pool.end();
