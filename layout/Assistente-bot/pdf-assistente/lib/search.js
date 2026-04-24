function similarity(a, b) {
    const aWords = a.toLowerCase().split(/\W+/);
    const bWords = b.toLowerCase().split(/\W+/);
  
    const common = aWords.filter(word => bWords.includes(word));
    return common.length;
  }
  
  export function search(query, chunks) {
    const scored = chunks.map(chunk => ({
      chunk,
      score: similarity(query, chunk),
    }));
  
    scored.sort((a, b) => b.score - a.score);
  
    return scored.slice(0, 3);
  }