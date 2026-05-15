export default async function handler(req, res) {
  const response = await fetch(
    'https://public-api.gdash.io/api/v1/solar/plants?apikey=3HnfW02lkFxhrG92G9Ek8'
  );
  const data = await response.json();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json(data);
}
