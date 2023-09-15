//how create tetris game in html
function TetrisGame(game_id) {
    this.canvas = document.getElementById("tetris-"+game_id);
    this._ctx = null;
    }
    TetrisGame.prototype={
        init: function() {
            this._ctx=this.canvas.getContext('2d');
            },
            drawBoard: function(){
                var ctx = this._ctx,
                boardWidth = 10,//width of board
                boardHeight = 35;//height of board
                //draw border
                /*                ctx.strokeStyle="#000";
                ctx.lineWidth="4px"*/
                /*                for (var i = 0 ;i<boardWidth+1;++i){
                    *                    if((i%2)==0)//horizontal line
                    {
                        *                        ctx.beginPath();
                        *                            ctx.moveTo(-6 + i*(cellSize), -8);//start point    
*                                ctx.lineTo(+7 + i*(cellSize), -8);//end point
*                                ctx.closePath();//to close the path
*                                ctx.stroke();//to stroke it
*                            }//if horizontal line ends here
*                        else{
    *                            ctx.beginPath();
    *                                ctx.moveTo(-6 + i*(cellSize), cellSize/2);//start point
    *                                    ctx.lineTo(+7 + i*(cellSize), cellSize/2);//end point
    *                                        ctx.closePath();//to close the path
    *                                            ctx.stroke();//to stroke it
    *                                                }//else vertical line ends here
    *                                                        }//for loop ends here  
    *                                                    */
   /*                ctx.fillStyle='#fff';
   *                ctx.fillRect((-9)*cellSize,-8*cellSize,(boardWidth+1)*(cellSize),(boardHeight+1)*(cell
   *                 Size));//filling background color to canvas
   *    */
  /*                ctx.font='bold '+Math.floor(((boardHeight)/2)+1)+'pt Arial'
  /*                ctx.textAlign='center';
  *        ctx.textBaseline ='middle';
  /*            ctx.fillStyle='#000';
  /*            ctx.fillText('Tetris', ((boardWidth / 2))*cellSize , (-8 )*cellSize);*/
  /*                ctx.save();
  /*                ctx.translate((((boardWidth )/2)-1)*cellSize, (((boardHeight)/2)-1)*cellSiz
  e );
  /*                ctx.rotate(.5*Math.PI);
  /*                ctx.scale(1,.5);
  /*                ctx.drawImage('./images/tetrominoes/I.png', -(cellSize/2),-(cellSize/2),
  cellSize,cellSize);
  /*                ctx.restore();*/
  /*                ctx.save();
  /*                ctx.translate((((boardWidth-1) / 2)) * cellSize, (((boardHeight-1) /
  2 )) * cellSize);
  /*                ctx.rotate(-.5*Math.PI);
  /*                ctx.scale(.5, .5);
  /*                ctx.drawImage('./images/tetrominoes/O.png', -(cellSize/2),-(cellSize/2),
  cellSize,cellSize);
  /*                ctx.restore();*/
  /*                ctx.save();
  /*                ctx.translate((((boardWidth-1) / 2)) * cellSize, (((boardHeight-1) /
  2 )) * cellSize);
  /*                ctx.rotate(-.3*Math.PI);
  *                ctx.scale(.5, .5);
  /*                ctx.drawImage('./images/tetrominoes/L.png', -(cellSize/2),-(cellSize/2),
  cellSize,cellSize);
  /*                ctx.restore();*/
  /*                ctx.save();
  /*                    ctx.translate(( ( boardWidth-1)/2 ) * cellSize, ( ( boardHeight-1)/2 ) * cel
  lSize);
  /*                     ctx.rotate(-.4*Math.PI);
  /*                      ctx.scale(.5, .5);
  /*                         ctx.drawImage('./images/tetrominoes/J.png', - ( cellSize/2 ), - ( celle
    size/2 ), cellSize, cellSize);
    /*                          ctx.restore();*/
    /*                        ctx.save();
    /*                            ctx.translate(( ( boardWidth-1)/2 ) * cellSize, ( ( boardHeight-1)/2 ) * cel
    /*                            ctx.translate(( ( boardWidth-1)/2 ) * cellSize, ( ( boardHeight-1)/2 ) * cel
    /*                            ctx.translate(( ( boardWidth-1)/2 ) * cellSize, ( ( boardHeight-1)/2 ) * cel
    /*                            ctx.translate(( ( boardWidth-1)/2 ) * cellSize, ( ( boardHeight-1)/2 ) * cellSize);
    /*                             ctx.rotate(-.6*Math.PI);
    /*                              ctx.scale(.5, .5);
    ctx.drawImage('./images/tetrominoes/T.png', - ( cellSize/2 ), - ( cellSize/2 ),
    cellSize, cellSize);
    /*                                ctx.restore();*/
    /*                                    for (var i = 0; i < this._currentPiece.shape.length ; ++i){
        */
       }
       }
       