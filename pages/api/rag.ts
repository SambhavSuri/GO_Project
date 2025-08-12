// import type { NextApiRequest, NextApiResponse } from 'next';

// // API route for RAG service
// export default async function handler(
//   req: NextApiRequest,
//   res: NextApiResponse
// ) {
//   if (req.method !== 'POST') {
//     return res.status(405).json({ message: 'Method not allowed' });
//   }

//   const { query, n_results = 1 } = req.body;

//   if (!query) {
//     return res.status(400).json({ message: 'Query is required' });
//   }

//   try {
//     // Get the RAG endpoint URL and access token from environment variables
//     const ragEndpointUrl = process.env.RAG_ENDPOINT_URL;
//     const ragAccessToken = process.env.RAG_ACCESS_TOKEN;
    
//     if (!ragEndpointUrl) {
//       console.error('RAG_ENDPOINT_URL not configured');
//       return res.status(500).json({ message: 'RAG service not configured' });
//     }

//     if (!ragAccessToken) {
//       console.error('RAG_ACCESS_TOKEN not configured');
//       return res.status(500).json({ message: 'RAG access token not configured' });
//     }

//     // Forward the request to your RAG service with bearer token
//     const response = await fetch(ragEndpointUrl, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${ragAccessToken}`,
//       },
//       body: JSON.stringify({
//         query,
//         n_results,
//       }),
//     });

//     if (!response.ok) {
//       const error = await response.text();
//       console.error('RAG service error:', error);
//       return res.status(response.status).json({ 
//         message: 'RAG service error', 
//         details: error 
//       });
//     }

//     // Parse and return the JSON response
//     const data = await response.json();
    
//     // Return the structured response with answer and sources
//     return res.status(200).json(data);

//   } catch (error) {
//     console.error('RAG API error:', error);
//     res.status(500).json({ 
//       message: 'Internal server error',
//       error: error instanceof Error ? error.message : 'Unknown error'
//     });
//   }
// }

// // API configuration
// export const config = {
//   api: {
//     bodyParser: {
//       sizeLimit: '1mb',
//     },
//   },
// };