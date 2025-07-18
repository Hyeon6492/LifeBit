def normalize_korean_amount(amount: str) -> str:
    synonyms = [
        ('뚝배기', '그릇'), ('1뚝배기', '1그릇'),
        ('인분', '그릇'), ('1인분', '1그릇'), ('한 인분', '한 그릇'),
        ('사발', '그릇'), ('1사발', '1그릇'), ('1 사발', '1그릇'), ('한 사발', '한 그릇'),
        ('한토막', '한 조각'), ('1토막', '1조각'),
        ('한덩이', '한 개'), ('1덩이', '1개'),
        ('한줌', '한 개'), ('1줌', '1개'),
        ('한사발', '한 그릇'), ('한모', '한 개'), ('1모', '1개'),
        ('한장', '한 개'), ('1장', '1개'),
        ('한조각', '한 조각'), ('1조각', '1조각'),
        ('한입', '한 개'), ('1입', '1개'),
        ('한 알', '한 개'), ('1알', '1개'),
        ('한 봉지', '한 개'), ('1봉지', '1개'),
        ('한 캔', '한 개'), ('1캔', '1개'),
        ('한 병', '한 개'), ('1병', '1개'),
        ('한 컵', '한 컵'), ('1컵', '1컵'),
        ('한 잔', '한 컵'), ('1잔', '1컵'),
        ('한 판', '한 개'), ('1판', '1개'),
        ('한 줄', '한 개'), ('1줄', '1개'),
        ('한 쪽', '한 조각'), ('1쪽', '1조각'),
        ('한 스푼', '한 큰술'), ('1스푼', '1큰술'),
        ('한 숟가락', '한 큰술'), ('1숟가락', '1큰술'),
        ('한 작은술', '한 작은술'), ('1작은술', '1작은술'),
        ('한 그릇', '한 그릇'), ('1그릇', '1그릇'),
        ('한 공기', '한 그릇'), ('1공기', '1그릇'),
        ('한 개', '한 개'), ('1개', '1개')
    ]
    normalized = amount.replace(' ', '')  # Remove all spaces for robust matching
    for from_str, to_str in synonyms:
        normalized = normalized.replace(from_str.replace(' ', ''), to_str)
    return normalized 