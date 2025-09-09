# Scriptware Prepaid Betaling

Voor vertaalopdrachten voor het MKB en particulieren is een betaling vooraf noodzakelijk. Ik heb hier een betaal portal voor ontwikkeld.

## Gebruikte technologie

- **Mollie** Veilige en efficiënte verwerking van betalingen via verschillende methoden. 
- **Sendgrid** Verzenden van transactionele e-mails middels een RESTful API.
- **Plunet** Project Management System voor vertaalbureaus.
- **Netlify** Voor het hosten van de frontend en de backend serverless functions
- **GitLab** Voor versiebeheer van de code en elke nieuwe push word automatisch naar Netlify verstuurd.
- **Gatsby** React-based frontend framework.

## Workflow

### 1. Offerte verzenden

Een salesmanager verzend een offerte vanuit Plunet naar de klant:

<img src="/readme/offerte-mail.jpg" width="500px" />

<sup>*E-mail met offerte die de klant ontvangt*</sup>

Dit e-mail template is door mij gemaakt. De knop 'Akkoord an Betalen' verwijst naar het url van de webapp die de betaling afhandelt. Middels het url wordt het offerte nummer meegegeven aan de betaal portal. Het url ziet er als volgt uit:

```http
https://payment.scriptwaretranslations.com/nl-nl/Q-12675-01
```

Omdat de klanten van Scriptware niet alleen uit Nederland komen is de portal ook beschikbaar in het Engels. Het onderscheid wordt gemaakt door `nl-nl` in het url voor Nederlands en `en-gb` in het url voor Engels.

### 2. Betaallink genereren

Zodra de klant de portal bezoekt wordt een Mollie betaallink gegenereerd. Voor het genereren van de betaallink maakt de frontend gebruik van het volgende backend API endpoint:

```http
GET /.netlify/functions/link
```

Het backend API endpoint maakt gebruik van de Plunet SOAP API om gegevens van de klant en offerte op te halen. Deze gegevens worden gebruikt om met de Mollie RESTfull API een betaallink te genereren.

De response van de backend API endpoint naar de frontend is een betaallink of een error dat er geen adresgegevens bekend zijn voor de klant. Is er een betaallink beschikbaar, dan vindt er op de frontend een redirect plaats naar de betaalomgeving van Mollie. Zijn er geen adresgegevens bekend, dan toont de frontend een formulier waar de klant de adresgegevens moet invullen. 

### 3. Adresgegevens

Om de drempel bij de offerte aanvraag zo laag mogelijk te houden, worden er geen adresgegevens gevraagd. Om de btw te berekenen en een factuur te kunnen maken zijn deze wel noodzakelijk. Dus als ze nog niet bekend zijn voor een klant, dan moet die eerst ingevuld worden voordat een offerte betaald kan worden. Daarvoor wordt het volgende formulier op de frontend gebruikt.

<img src="/readme/adresgegevens.jpg" width="500px" />

<sup>*Adresgegevens invullen in de webapp*</sup>

Voor het formulier heb ik het design van Mollie nagemaakt. Op die manier ziet de klant geen verschil tussen het adres invullen, wat aan portal kant ligt en de betaling, wat aan de Mollie kant ligt.

Voor het opslaan van het adres maakt de frontend gebruik van het volgende backend API endpoint:

```http
POST /.netlify/functions/address
```

Het API endpoint maakt gebruik van de Plunet SOAP API om de adresgegevens en btw. instellingen op te slaan.

Vervolgens maakt de frontend opnieuw gebruik van het `/.netlify/functions/link` backend API endpoint om een Mollie betaallink te genereren en vindt er een redirect naar deze link plaats op de frontend.

### 4. Betalen

Na de redirect op de frontend wordt de klant doorgestuurd naar de betaalfaciliteit van Mollie waar de betaling plaatsvindt:

<img src="/readme/mollie-betaling.jpg" width="500px" />

<sup>*Betaalomgeving van Mollie*</sup>

### 5. Succesvolle betaling

Nadat de betaling succesvol is gelukt stuurt Mollie een request naar het volgende backend API endpoint:

```http
POST /.netlify/functions/status
```

Daarbij wordt het quote nummer meegestuurd in de querystring en de Mollie payment ID als body parameter.

Het API endpoint checkt middels het Mollie payment ID en de Mollie RESTfull API of de betaling daadwerkelijk succesvol is.

Het API endpoint gebruikt de Plunet SOAP API om de quote status op `Accepted` te zetten.

Het API endpoint gebruikt de Sendgrid RESTfull API om een mail naar de klant te sturen:

<img src="/readme/betaling-succes.jpg" width="500px" />

<sup>*E-mail naar klant*</sup>

Het API endpoint gebruikt de Sendgrid RESTfull API om een mail naar de Project Managers te sturen:

<img src="/readme/betaling-succes-pm.jpg" width="500px" />

<sup>*E-mail naar Project Managers*</sup>

Hoewel deze e-mails vanuit Sendgrid worden verzonden zien ze er exact hetzelfde uit als de e-mail die eerder uit Plunet verzonden is. Hierdoor ziet de klant het verschil niet tussen de verschillende systemen die gebruikt worden.